# matches/admin_views.py
from django.contrib import admin, messages
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render, redirect
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db import transaction
from django.conf import settings
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse, HttpResponseBadRequest

import json
import re  # ⬅️ NEW

from clubs.models import Club
from players.models import Player
from .models import Match, Round, Goal, Card


# ======================================
# Constantes & configuration
# ======================================

ADMIN_STATUSES = [
    ("SCHEDULED", "Non débuté"),
    ("LIVE",      "En cours"),
    ("HT",        "Mi-temps"),
    ("FT",        "Terminé"),
    ("SUSPENDED", "Suspendu"),
    ("POSTPONED", "Reporté"),
    ("CANCELED",  "Annulé"),
]

# Création automatique des joueurs manquants
# Désactive via: PFOOT_AUTO_CREATE_PLAYERS = False (dans settings.py)
AUTO_CREATE_PLAYERS = getattr(settings, "PFOOT_AUTO_CREATE_PLAYERS", True)


# ======================================
# Helpers généraux
# ======================================

def _normalize_status(raw: str) -> str:
    s = (raw or "SCHEDULED").upper().strip()
    if s in {"POST", "POSTPONE", "POSTPONED"}: return "POSTPONED"
    if s in {"CAN", "CANCELLED", "CANCELED"}:  return "CANCELED"
    if s in {"FT", "FINISHED"}:                return "FT"
    if s in {"HT", "PAUSED"}:                  return "HT"
    if s in {"LIVE", "SCHEDULED", "SUSPENDED"}:return s
    return "SCHEDULED"

def _parse_dt(raw: str):
    if not raw: return timezone.now()
    dt = parse_datetime(raw)
    if not dt:  return timezone.now()
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt

def _to_int(s, default=0):
    try:
        return int(str(s).strip())
    except Exception:
        return default

def _resolve_club(value):
    if value is None: return None
    s = str(value).strip()
    if not s: return None
    if s.isdigit():
        return Club.objects.filter(pk=int(s)).first()
    club, _ = Club.objects.get_or_create(name=s)
    return club

def _normalize_card_color(raw: str) -> str:
    if not raw: return "Y"
    s = raw.strip().upper()
    if s in {"Y", "JAUNE", "YELLOW"}: return "Y"
    if s in {"R", "ROUGE", "RED"}:    return "R"
    return "Y"

def _extract_minute(token: str) -> int:
    if not token: return 0
    t = token.strip().replace("’", "'").replace("`", "'")
    t = t.replace("min", "").replace("'", "").replace("’", "")
    if "+" in t:
        base, add = t.split("+", 1)
        return _to_int(base) + _to_int(add)
    return _to_int(t)

def _model_has_field(model, name: str) -> bool:
    try:
        model._meta.get_field(name)
        return True
    except Exception:
        return False

def _field_max_len(model, name: str):
    """Retourne max_length si dispo, sinon None."""
    try:
        f = model._meta.get_field(name)
        return getattr(f, "max_length", None)
    except Exception:
        return None

def _set_card_color_kwargs(kwargs: dict, color_code: str) -> dict:
    """
    Mappe 'Y'/'R' vers les champs réellement présents sur Card.
    Respecte max_length pour éviter "Data too long for column 'type'".
    """
    c = (color_code or "Y").strip().upper()
    word = "YELLOW" if c == "Y" else "RED"

    def set_value(field: str, prefer_word=False):
        if not _model_has_field(Card, field):
            return
        ml = _field_max_len(Card, field)
        if ml is not None and ml <= 2:
            kwargs[field] = c
        else:
            kwargs[field] = word if prefer_word or (ml and ml >= 3) else c

    # champs possibles selon ton modèle
    set_value("color")            # souvent 'Y'/'R'
    set_value("card")             # souvent 'Y'/'R'
    set_value("card_type", True)  # souvent 'YELLOW'/'RED'
    set_value("type")             # auto selon max_length

    if _model_has_field(Card, "is_yellow"):
        kwargs["is_yellow"] = (c == "Y")
    if _model_has_field(Card, "is_red"):
        kwargs["is_red"] = (c == "R")
    return kwargs

def _is_truthy(v):
    return (
        v is True
        or v == 1
        or (isinstance(v, str) and v.strip().lower() in {"1", "true", "yes", "y", "on"})
    )

def _set_goal_type_kwargs(kwargs: dict, is_penalty: bool, is_own_goal: bool, clear_when_false: bool = True) -> dict:
    """
    Renseigne/efface les champs du modèle Goal selon ce qui existe:
    - booleans: penalty / is_penalty / on_penalty
                own_goal / is_own_goal / og
    - texte: type/kind = 'PEN' ou 'OG' (respecte max_length)
    Si clear_when_false=True et aucun flag, on met les booléens à False et vide type/kind.
    """
    from .models import Goal  # import local

    # Booleans penalty
    for f in ("penalty", "is_penalty", "on_penalty"):
        if _model_has_field(Goal, f):
            kwargs[f] = bool(is_penalty)

    # Booleans own goal
    for f in ("own_goal", "is_own_goal", "og"):
        if _model_has_field(Goal, f):
            kwargs[f] = bool(is_own_goal)

    # Champ texte type/kind
    wanted = "PEN" if is_penalty else ("OG" if is_own_goal else "")
    for field in ("type", "kind"):
        if _model_has_field(Goal, field):
            ml = _field_max_len(Goal, field)
            val = wanted[:ml] if ml and wanted else wanted
            if wanted or clear_when_false:
                kwargs[field] = val
            break

    return kwargs

# --- Fallback CSC si aucun champ dédié n’existe ---
def _ensure_csc_fallback_kwargs(goal_kwargs: dict, is_own_goal: bool) -> dict:
    """
    Si le modèle Goal ne possède AUCUN des champs (own_goal / is_own_goal / og / type / kind),
    on dépose 'CSC' dans assist_name (si présent) pour permettre au front d'afficher (csc).
    """
    if not is_own_goal:
        return goal_kwargs
    has_store = any(
        _model_has_field(Goal, f) for f in ("own_goal", "is_own_goal", "og", "type", "kind")
    )
    if not has_store and _model_has_field(Goal, "assist_name"):
        goal_kwargs.setdefault("assist_name", "CSC")
    return goal_kwargs


# ============ NEW: Rounds helpers (J1→J26, ordre stable) ============
def _infer_round_number_from_name(name: str):
    """Essaie d'inférer un numéro depuis 'J1', 'Journée 1', 'Journee 1'…"""
    if not name:
        return None
    s = str(name).lower()
    m = re.search(r"j(?:ourn[ée]e)?\s*(\d{1,3})", s)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            return None
    m2 = re.search(r"\b(\d{1,3})\b", s)
    if m2:
        try:
            return int(m2.group(1))
        except Exception:
            return None
    return None

def _ensure_rounds_seeded(total=26):
    """
    Idempotent:
      - complète r.number si manquant (depuis le name si possible)
      - crée J1..J<total> manquants
    """
    # 1) Tenter de compléter number depuis name
    for r in Round.objects.all():
        if getattr(r, "number", None) in (None, 0):
            n = _infer_round_number_from_name(getattr(r, "name", "") or "")
            if n:
                try:
                    # si name vide, le poser en "J<n>"
                    if not (r.name or "").strip():
                        r.name = f"J{n}"
                        r.save(update_fields=["number", "name"])
                    else:
                        r.number = n
                        r.save(update_fields=["number"])
                except Exception:
                    # en cas de contrainte unique ou conflit, on ignore
                    pass

    # 2) Créer les manquants 1..total
    existing = set(Round.objects.filter(number__isnull=False).values_list("number", flat=True))
    for n in range(1, total + 1):
        if n in existing:
            continue
        try:
            Round.objects.create(number=n, name=f"J{n}")
        except Exception:
            # si une contrainte empêche, on ignore
            pass


# ======================================
# Joueurs: parsing & résolution
# ======================================

def _parse_actor_token(text: str):
    """
    Analyse un token joueur et renvoie (kind, value)
    - '#23'     -> ('number', 23)
    - 'id:23'   -> ('id', 23)
    - '23'      -> ('number', 23)  (par défaut un numérique = numéro)
    - 'John Doe'-> ('name', 'John Doe')
    """
    s = (text or "").strip()
    low = s.lower()
    if not s:
        return None, None
    if low.startswith("id:"):
        n = _to_int(s[3:].strip(), None)
        return ("id", n) if n is not None else (None, None)
    if s.startswith("#"):
        n = _to_int(s[1:].strip(), None)
        return ("number", n) if n is not None else (None, None)
    if s.isdigit():
        return ("number", int(s))
    return ("name", s)

def _resolve_player_from_kind(kind: str, value, club=None):
    """
    Résout/Crée un joueur selon 'kind':
      - 'number': cherche Player.number=value (club). Crée si autorisé.
      - 'id'    : cherche pk=value (on restreint au club si possible). Ne crée pas.
      - 'name'  : cherche first_name/last_name (club). Crée si autorisé.
    """
    if not kind:
        return None

    qs = Player.objects.all()
    if club:
        qs = qs.filter(club=club)

    if kind == "number":
        if value is None:
            return None
        pl = qs.filter(number=int(value)).first()
        if pl:
            return pl
        if AUTO_CREATE_PLAYERS and club:
            return Player.objects.create(number=int(value), club=club)
        return None

    if kind == "id":
        if value is None:
            return None
        pl = qs.filter(pk=int(value)).first()
        if pl:
            return pl
        if not club:
            return Player.objects.filter(pk=int(value)).first()
        return Player.objects.filter(pk=int(value), club=club).first()

    if kind == "name":
        parts = str(value).split()
        if len(parts) >= 2:
            first = parts[0]
            last = " ".join(parts[1:])
            pl = qs.filter(Q(first_name__iexact=first) & Q(last_name__iexact=last)).first()
            if pl:
                return pl
        pl = qs.filter(Q(first_name__iexact=str(value)) | Q(last_name__iexact=str(value))).first()
        if pl:
            return pl
        if AUTO_CREATE_PLAYERS and club:
            first = parts[0]
            last = " ".join(parts[1:]) if len(parts) > 1 else ""
            return Player.objects.create(first_name=first, last_name=last, club=club)
        return None

    return None


# ======================================
# Parsing lignes buts & cartons
# ======================================

def _parse_goal_line(line: str):
    """
    Formats tolérés (1 ligne = 1 but) :
      "John Doe 12'"
      "John Doe 12' (Assist Name)"
      "23 45' (10)"      # 23 = buteur #23 ; 10 = passeur #10
      "#9 67' (id:42)"   # forçages explicites
      "#9 67' pen"       # penalty
      "Traoré 37' csc"   # contre son camp
      "id:42 45+2 (pen)"
    Retour: dict { minute, player_kind, player_value, assist_kind?, assist_value?,
                   is_penalty, is_own_goal }
    """
    raw = (line or "").strip()
    if not raw:
        return None

    assist_token = None
    tags = []

    # 1) extraire éventuelles parenthèses : soit assist, soit tag (pen/csc)
    if "(" in raw and ")" in raw:
        inside = raw[raw.find("(") + 1 : raw.rfind(")")].strip()
        if inside:
            t = inside.replace(".", "").replace("_", "").lower()
            if t in {"pen", "p", "pk", "penalty", "csc", "og", "owngoal", "own goal"}:
                tags.append(t)
            else:
                assist_token = inside
        raw = (raw[: raw.find("(")] + raw[raw.rfind(")") + 1 :]).strip()

    parts = raw.split()
    minute = 0
    min_idx = None

    # 2) trouver la minute n'importe où dans la ligne
    for i, tok in enumerate(parts):
        mm = _extract_minute(tok)
        if mm > 0:
            minute = mm
            min_idx = i
            break

    # 3) qui marque ? (ce qu'il y a avant la minute, sinon toute la ligne)
    who = " ".join(parts[:min_idx]).strip() if min_idx is not None else " ".join(parts).strip()

    # 4) tags éventuels après la minute (pen/csc)
    if min_idx is not None and min_idx + 1 < len(parts):
        trailing = [t.strip("[]().,;").lower() for t in parts[min_idx + 1 :]]
        tags.extend(trailing)

    # 5) normaliser les tags
    tagset = set()
    for t in tags:
        t = t.replace(".", "")
        if t in {"pen", "p", "pk", "penalty"}:
            tagset.add("pen")
        if t in {"csc", "og", "owngoal", "own"}:
            tagset.add("og")

    pkind, pval = _parse_actor_token(who)
    akind, aval = (None, None)
    if assist_token:
        akind, aval = _parse_actor_token(assist_token)

    return {
        "minute": minute,
        "player_kind": pkind,
        "player_value": pval,
        "assist_kind": akind,
        "assist_value": aval,
        "is_penalty": "pen" in tagset,
        "is_own_goal": "og" in tagset,
    }

def _parse_card_line(line: str):
    """
    Formats tolérés (1 ligne = 1 carton) :
      "John Doe 17' Y"
      "23 52' R"
      "#5 90+2 Y"
      "id:42 12' R"
    Retour: dict { minute, color, player_kind, player_value }
    """
    raw = (line or "").strip()
    if not raw:
        return None

    parts = raw.split()
    if not parts:
        return None

    color = None
    minute = 0
    who_parts = parts[:]

    if len(parts) >= 2:
        maybe_min = _extract_minute(parts[-2])
        maybe_col = _normalize_card_color(parts[-1])
        if maybe_min > 0 and maybe_col in {"Y", "R"}:
            minute = maybe_min
            color = maybe_col
            who_parts = parts[:-2]
        else:
            maybe_min2 = _extract_minute(parts[-1])
            if maybe_min2 > 0:
                minute = maybe_min2
                who_parts = parts[:-1]

    if not color:
        color = "Y"

    who = " ".join(who_parts).strip()
    if not who:
        return None

    pkind, pval = _parse_actor_token(who)

    return {
        "minute": minute,
        "color": color,
        "player_kind": pkind,
        "player_value": pval,
    }


# ======================================
# VUES ADMIN (pages HTML)
# ======================================

@staff_member_required
def quick_add_match_view(request):
    """Vue HTML d’ajout/édition rapide de match."""
    # ⬇️ NEW: garantir une base propre des journées (J1..J26 + number renseigné)
    _ensure_rounds_seeded(total=26)

    if request.method == "POST":
        home_val = request.POST.get("home_id") or request.POST.get("home") or ""
        away_val = request.POST.get("away_id") or request.POST.get("away") or ""

        home = _resolve_club(home_val)
        away = _resolve_club(away_val)

        if not home or not away:
            messages.error(request, "Sélectionne correctement les deux équipes (picker ou nom).")
            return redirect("admin_quick_match")
        if home.id == away.id:
            messages.error(request, "Les deux équipes ne peuvent pas être identiques.")
            return redirect("admin_quick_match")

        try:
            home_score = int(request.POST.get("home_score") or 0)
        except Exception:
            home_score = 0
        try:
            away_score = int(request.POST.get("away_score") or 0)
        except Exception:
            away_score = 0
        try:
            minute = int(request.POST.get("minute") or 0)
        except Exception:
            minute = 0

        status = _normalize_status(request.POST.get("status"))
        buteur = (request.POST.get("buteur") or "").strip()

        round_id = request.POST.get("round_id") or ""
        rnd = Round.objects.filter(id=round_id).first() if str(round_id).isdigit() else None
        if rnd is None:
            # ⬇️ NEW: fallback sur la plus petite journée (J1 en priorité)
            rnd = Round.objects.order_by("number", "id").first()

        kickoff_raw = (request.POST.get("kickoff_at") or "").strip()
        dt = _parse_dt(kickoff_raw)

        if Match.objects.filter(round=rnd, home_club=home, away_club=away).exists():
            messages.warning(request, "Un match identique existe déjà pour cette journée.")
            return redirect("admin_quick_match")

        Match.objects.create(
            round=rnd,
            datetime=dt,
            home_club=home,
            away_club=away,
            home_score=home_score,
            away_score=away_score,
            status=status,
            minute=minute,
            buteur=buteur,
        )
        messages.success(request, "Match ajouté avec succès.")
        return redirect("admin_quick_match")

    matches = (
        Match.objects
        .select_related("home_club", "away_club", "round")
        .order_by("-id")[:50]
    )

    ctx = {
        "STATUSES": ADMIN_STATUSES,
        # ⬇️ NEW: ordre par numéro puis id (J1→J26)
        "rounds": Round.objects.order_by("number", "id"),
        "matches": matches,
    }
    ctx.update(admin.site.each_context(request))
    return render(request, "admin/matches/quick_add.html", ctx)


@staff_member_required
def quick_events(request):
    """
    Saisie rapide des buts & cartons via 2 textareas.
    Conventions utiles : '#23' = numéro 23, 'id:23' = ID 23, '23' = numéro 23.
    Ajoute 'pen/p/pk/penalty' pour un pénalty ; 'csc/og' pour c.s.c.
    """
    if request.method == "POST":
        match_id = request.POST.get("match_id")
        club_val = request.POST.get("club_id") or request.POST.get("club") or ""
        goals_text = request.POST.get("goals_text") or ""
        cards_text = request.POST.get("cards_text") or ""

        match = (
            Match.objects
            .select_related("home_club", "away_club")
            .filter(id=_to_int(match_id))
            .first()
        )
        if not match:
            messages.error(request, "Match introuvable.")
            return redirect("admin_quick_events")

        club = _resolve_club(club_val)
        if not club or (club.id not in {match.home_club_id, match.away_club_id}):
            messages.error(request, "Sélectionne un club du match.")
            return redirect("admin_quick_events")

        created_goals, created_cards = 0, 0

        with transaction.atomic():
            # ===== BUTS =====
            for line in goals_text.splitlines():
                parsed = _parse_goal_line(line)
                if not parsed:
                    continue

                minute = parsed.get("minute", 0)

                # Buteur
                scorer = _resolve_player_from_kind(parsed.get("player_kind"), parsed.get("player_value"), club=club)
                if not scorer:
                    continue  # auto-create désactivé ou échec de résolution

                # Passeur (optionnel)
                assist_player = None
                ak, av = parsed.get("assist_kind"), parsed.get("assist_value")
                if ak:
                    assist_player = _resolve_player_from_kind(ak, av, club=club)

                # Flags pen/csc
                is_pen = bool(parsed.get("is_penalty"))
                is_og  = bool(parsed.get("is_own_goal"))

                # Champs réels du modèle Goal uniquement
                goal_kwargs = dict(match=match, club=club, minute=minute, player=scorer)
                if assist_player:
                    if _model_has_field(Goal, "assist"):
                        goal_kwargs["assist"] = assist_player
                    elif _model_has_field(Goal, "assist_player"):
                        goal_kwargs["assist_player"] = assist_player

                # Applique flags + fallback CSC
                goal_kwargs = _set_goal_type_kwargs(goal_kwargs, is_pen, is_og, clear_when_false=True)
                goal_kwargs = _ensure_csc_fallback_kwargs(goal_kwargs, is_og)

                Goal.objects.create(**goal_kwargs)
                created_goals += 1

            # ===== CARTONS =====
            for line in cards_text.splitlines():
                parsed = _parse_card_line(line)
                if not parsed:
                    continue

                minute = parsed.get("minute", 0)
                color  = parsed.get("color", "Y")

                pl = _resolve_player_from_kind(parsed.get("player_kind"), parsed.get("player_value"), club=club)
                if not pl:
                    continue

                card_kwargs = dict(match=match, club=club, minute=minute, player=pl)
                card_kwargs = _set_card_color_kwargs(card_kwargs, color)

                Card.objects.create(**card_kwargs)
                created_cards += 1

        messages.success(request, f"Événements enregistrés: {created_goals} but(s), {created_cards} carton(s).")
        return redirect("admin_quick_events")

    # GET
    matches = (
        Match.objects
        .select_related("home_club", "away_club", "round")
        .order_by("-id")[:100]
    )
    ctx = {
        "STATUSES": ADMIN_STATUSES,
        "rounds": Round.objects.filter(number__isnull=False).order_by("number", "id"), # ⬅️ ordre J1→
        "matches": matches,
        "clubs": Club.objects.order_by("name"),
    }
    ctx.update(admin.site.each_context(request))
    return render(request, "admin/events/quick_events.html", ctx)


# ======================================
# API JSON admin (édition inline)
# ======================================

def _abs_url(request, url_or_field):
    if not url_or_field:
        return None
    try:
        u = url_or_field.url
    except Exception:
        u = str(url_or_field)
    if not u:
        return None
    if u.startswith("http"):
        return u
    return request.build_absolute_uri(u) if request else u

def _serialize_goal(g, request):
    p = getattr(g, "player", None)
    a = getattr(g, "assist", None) or getattr(g, "assist_player", None)

    def _get_bool(obj, *names):
        for n in names:
            if hasattr(obj, n):
                return bool(getattr(obj, n))
        return False

    return {
        "id": g.id,
        "minute": g.minute,
        "club_id": g.club_id,
        "club_name": getattr(g.club, "name", ""),
        "player_id": getattr(p, "id", None),
        "player_name": ((getattr(p, "first_name", "") + " " + getattr(p, "last_name", "")).strip()
                        or (f"#{p.number}" if getattr(p, "number", None) else "")) if p else "",
        "player_number": getattr(p, "number", None) if p else None,
        "player_photo": _abs_url(request, getattr(p, "photo", None)) if p else None,
        "assist_id": getattr(a, "id", None) if a else None,
        "assist_name": ((getattr(a, "first_name", "") + " " + getattr(a, "last_name", "")).strip()
                        or (f"#{a.number}" if getattr(a, "number", None) else "")) if a else "",
        "is_penalty": _get_bool(g, "is_penalty", "penalty", "on_penalty"),
        "is_own_goal": _get_bool(g, "is_own_goal", "own_goal", "og"),
        "type": getattr(g, "type", None) or getattr(g, "kind", None),
    }

def _serialize_card(c, request):
    p = getattr(c, "player", None)
    color = getattr(c, "color", None) or getattr(c, "card", None) or getattr(c, "type", None) or getattr(c, "card_type", None)
    return {
        "id": c.id,
        "minute": c.minute,
        "club_id": c.club_id,
        "club_name": getattr(c.club, "name", ""),
        "color": str(color) if color is not None else None,
        "player_id": getattr(p, "id", None),
        "player_name": ((getattr(p, "first_name", "") + " " + getattr(p, "last_name", "")).strip()
                        or (f"#{p.number}" if getattr(p, "number", None) else "")) if p else "",
        "player_number": getattr(p, "number", None) if p else None,
        "player_photo": _abs_url(request, getattr(p, "photo", None)) if p else None,
    }

def _json(request):
    if request.content_type and "application/json" in request.content_type:
        try:
            return json.loads(request.body.decode("utf-8"))
        except Exception:
            return {}
    return request.POST

@staff_member_required
@require_http_methods(["GET", "POST", "DELETE"])
def quick_events_api(request):
    """
    API admin (JSON) pour lister / modifier / supprimer les buts & cartons,
    et uploader la photo d’un joueur.
    Param 'action':
      - GET  action=list&match_id=...
      - POST action=update_goal  {id, minute?, player_token?, assist_token?, is_penalty?, is_own_goal?}
      - POST action=delete_goal  {id}
      - POST action=update_card  {id, minute?, player_token?, color?}
      - POST action=delete_card  {id}
      - POST action=upload_photo (multipart) fields: player_id, photo
    """
    action = request.GET.get("action") or request.POST.get("action")

    if request.method == "GET":
        if action != "list":
            return HttpResponseBadRequest("action=list attendu")
        match_id = _to_int(request.GET.get("match_id"))
        if not match_id:
            return HttpResponseBadRequest("match_id manquant")

        goals = (Goal.objects
                 .select_related("player", "assist", "assist_player", "club")
                 .filter(match_id=match_id)
                 .order_by("minute", "id"))
        cards = (Card.objects
                 .select_related("player", "club")
                 .filter(match_id=match_id)
                 .order_by("minute", "id"))

        return JsonResponse({
            "goals": [_serialize_goal(g, request) for g in goals],
            "cards": [_serialize_card(c, request) for c in cards],
        })

    # POST/DELETE
    data = _json(request)

    # --- UPDATE GOAL ---
    if action == "update_goal":
        g = Goal.objects.select_related("player", "club").filter(id=_to_int(data.get("id"))).first()
        if not g:
            return HttpResponseBadRequest("But introuvable")

        # minute
        if "minute" in data and str(data["minute"]).strip() != "":
            g.minute = _to_int(data["minute"], g.minute)

        # joueur
        if data.get("player_token"):
            kind, value = _parse_actor_token(str(data["player_token"]))
            pl = _resolve_player_from_kind(kind, value, club=g.club)
            if pl:
                g.player = pl

        # passeur
        if "assist_token" in data:
            token = str(data.get("assist_token") or "").strip()
            if token:
                ak, av = _parse_actor_token(token)
                ap = _resolve_player_from_kind(ak, av, club=g.club)
            else:
                ap = None
            if _model_has_field(type(g), "assist"):
                g.assist = ap
            elif _model_has_field(type(g), "assist_player"):
                g.assist_player = ap

        # flags pen/csc
        if "is_penalty" in data or "is_own_goal" in data:
            is_pen = _is_truthy(data.get("is_penalty", "0"))
            is_og  = _is_truthy(data.get("is_own_goal", "0"))
            kw = {}
            _set_goal_type_kwargs(kw, is_pen, is_og, clear_when_false=True)
            for k, v in kw.items():
                setattr(g, k, v)

            # Fallback CSC si aucun champ dédié
            has_store = any(_model_has_field(Goal, f) for f in ("own_goal", "is_own_goal", "og", "type", "kind"))
            if is_og and not has_store and _model_has_field(Goal, "assist_name"):
                # Ne pas écraser un vrai passeur
                if not getattr(g, "assist", None) and not getattr(g, "assist_player", None):
                    g.assist_name = "CSC"
            # Si décoché, nettoyer un éventuel fallback
            if (not is_og) and _model_has_field(Goal, "assist_name"):
                if (getattr(g, "assist_name", "") or "").upper() == "CSC":
                    g.assist_name = None

        g.save()
        return JsonResponse({"ok": True, "goal": _serialize_goal(g, request)})

    # --- DELETE GOAL ---
    if action == "delete_goal":
        g = Goal.objects.filter(id=_to_int(data.get("id"))).first()
        if not g:
            return HttpResponseBadRequest("But introuvable")
        g.delete()
        return JsonResponse({"ok": True})

    # --- UPDATE CARD ---
    if action == "update_card":
        c = Card.objects.select_related("player", "club").filter(id=_to_int(data.get("id"))).first()
        if not c:
            return HttpResponseBadRequest("Carton introuvable")
        if "minute" in data and str(data["minute"]).strip() != "":
            c.minute = _to_int(data["minute"], c.minute)
        if data.get("player_token"):
            kind, value = _parse_actor_token(str(data["player_token"]))
            pl = _resolve_player_from_kind(kind, value, club=c.club)
            if pl:
                c.player = pl
        if data.get("color"):
            card_kwargs = {}
            _set_card_color_kwargs(card_kwargs, str(data["color"]))
            for k, v in card_kwargs.items():
                setattr(c, k, v)
        c.save()
        return JsonResponse({"ok": True, "card": _serialize_card(c, request)})

    # --- DELETE CARD ---
    if action == "delete_card":
        c = Card.objects.filter(id=_to_int(data.get("id"))).first()
        if not c:
            return HttpResponseBadRequest("Carton introuvable")
        c.delete()
        return JsonResponse({"ok": True})

    # --- UPLOAD PHOTO ---
    if action == "upload_photo":
        pid = _to_int(request.POST.get("player_id"))
        f = request.FILES.get("photo")
        if not pid or not f:
            return HttpResponseBadRequest("player_id et photo requis")
        p = Player.objects.filter(id=pid).first()
        if not p:
            return HttpResponseBadRequest("Joueur introuvable")
        p.photo = f
        p.save()
        return JsonResponse({"ok": True, "photo": _abs_url(request, p.photo)})

    return HttpResponseBadRequest("Action inconnue")
