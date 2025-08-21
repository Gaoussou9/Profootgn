# matches/views.py
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.http import require_POST

from rest_framework import viewsets, filters, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAdminUser

from .models import Match, Goal, Card, Round
from .serializers import (
    MatchSerializer,
    GoalSerializer,
    CardSerializer,
    RoundSerializer,
)

from players.models import Player
from clubs.models import Club


# -----------------------
# Permissions
# -----------------------
class ReadOnlyOrAdmin(permissions.IsAdminUser):
    """
    - GET/HEAD/OPTIONS : public
    - POST/PUT/PATCH/DELETE : admin uniquement
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return super().has_permission(request, view)


# -----------------------
# DRF ViewSets (API REST)
# -----------------------
class MatchViewSet(viewsets.ModelViewSet):
    """
    Endpoints:
      - /api/matches/            (liste filtrable/paginée)
      - /api/matches/{id}/
      - /api/matches/recent/     (terminés récents)
      - /api/matches/upcoming/   (programmés à venir)
      - /api/matches/live/       (LIVE + HT + PAUSED)
    """
    permission_classes = [ReadOnlyOrAdmin]
    serializer_class = MatchSerializer

    # Recherche & tri
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["home_club__name", "away_club__name", "venue"]
    ordering_fields = ["datetime", "minute", "id"]
    ordering = ["-datetime", "-id"]

    def get_queryset(self):
        """
        Pré-charge relations et applique filtres query string:
          - status: FINISHED ⇔ FT, LIVE inclut aussi HT & PAUSED
          - date_from/date_to (YYYY-MM-DD) sur la date de 'datetime'
        """
        qs = (
            Match.objects
            .select_related("home_club", "away_club", "round")
            .prefetch_related(
                Prefetch(
                    "goals",
                    queryset=Goal.objects.select_related("player", "club").order_by("minute", "id"),
                ),
                Prefetch(
                    "cards",
                    queryset=Card.objects.select_related("player", "club").order_by("minute", "id"),
                ),
            )
        )

        status = self.request.query_params.get("status")
        date_from = self.request.query_params.get("date_from")  # YYYY-MM-DD
        date_to   = self.request.query_params.get("date_to")    # YYYY-MM-DD

        if status:
            s = status.upper()
            if s == "FINISHED":
                qs = qs.filter(status__in=["FT", "FINISHED"])
            elif s == "LIVE":
                qs = qs.filter(status__in=["LIVE", "HT", "PAUSED"])  # inclure mi-temps & pause
            else:
                qs = qs.filter(status=s)

        if date_from:
            d = parse_date(date_from)
            if d:
                qs = qs.filter(datetime__date__gte=d)
        if date_to:
            d = parse_date(date_to)
            if d:
                qs = qs.filter(datetime__date__lte=d)

        return qs

    # -------- Actions pratiques pour le front -------- #
    @action(detail=False, methods=["get"])
    def recent(self, request):
        """Matchs terminés récents (non paginés). Param: page_size/limit (def=10)."""
        limit = int(request.query_params.get("page_size") or request.query_params.get("limit") or 10)
        qs = (
            self.get_queryset()
            .filter(status__in=["FT", "FINISHED"])
            .order_by("-datetime", "-id")[:limit]
        )
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        """Matchs programmés à venir (non paginés). Param: page_size/limit (def=10)."""
        limit = int(request.query_params.get("page_size") or request.query_params.get("limit") or 10)
        now = timezone.now()
        qs = (
            self.get_queryset()
            .filter(status="SCHEDULED", datetime__gte=now)
            .order_by("datetime", "id")[:limit]
        )
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def live(self, request):
        """Matchs en cours (inclut la mi-temps et les pauses)."""
        qs = (
            self.get_queryset()
            .filter(status__in=["LIVE", "HT", "PAUSED"])  # ← PAUSED inclus ici
            .order_by("-datetime", "-id")
        )
        return Response(self.get_serializer(qs, many=True).data)


class GoalViewSet(viewsets.ModelViewSet):
    """
    Lecture publique, modifications réservées à l’admin.
    + POST /api/goals/bulk/ pour créer/mettre à jour les buts d'un match.
    """
    authentication_classes = [SessionAuthentication, JWTAuthentication]
    permission_classes     = [ReadOnlyOrAdmin]

    queryset = Goal.objects.select_related("match", "player", "club")
    serializer_class = GoalSerializer

    @action(detail=False, methods=["post"], url_path="bulk", permission_classes=[IsAdminUser])
    def bulk(self, request):
        """
        Body JSON:
        {
          "match": 123,
          "replace": true,
          "goals": [
            {"club": 1, "minute": 12, "player": 45},
            {"club": 1, "minute": 54, "player_name": "Camara"},
            {"club": 2, "minute": 77, "player_name": "Diallo"}
          ]
        }
        """
        match_id = request.data.get("match")
        goals_in = request.data.get("goals", [])
        replace  = bool(request.data.get("replace"))

        if not match_id or not isinstance(goals_in, list):
            return Response({"ok": False, "detail": "Paramètres invalides."}, status=400)

        match = get_object_or_404(Match, pk=match_id)
        allowed_clubs = {match.home_club_id, match.away_club_id}

        with transaction.atomic():
            if replace:
                Goal.objects.filter(match=match).delete()

            to_create = []
            for g in goals_in:
                club_id = g.get("club")
                try:
                    club_id = int(club_id)
                except (TypeError, ValueError):
                    continue
                if club_id not in allowed_clubs:
                    continue

                club = get_object_or_404(Club, pk=club_id)

                minute = g.get("minute") or 0
                try:
                    minute = int(minute)
                except Exception:
                    minute = 0

                player = None
                player_id   = g.get("player")
                player_name = (g.get("player_name") or "").strip()

                if player_id:
                    player = get_object_or_404(Player, pk=player_id)
                elif player_name:
                    if hasattr(Player, "club"):
                        player = Player.objects.filter(name__iexact=player_name, club=club).first()
                        if not player:
                            player, _ = Player.objects.get_or_create(
                                name=player_name, defaults={"club": club}
                            )
                        elif getattr(player, "club_id", None) is None:
                            player.club = club
                            player.save(update_fields=["club"])
                    else:
                        player, _ = Player.objects.get_or_create(name=player_name)

                to_create.append(Goal(match=match, club=club, player=player, minute=minute))

            if to_create:
                Goal.objects.bulk_create(to_create)

        qs   = Goal.objects.filter(match=match).select_related("player", "club").order_by("minute", "id")
        data = GoalSerializer(qs, many=True, context={"request": request}).data
        return Response({"ok": True, "created": data})


class CardViewSet(viewsets.ModelViewSet):
    """Lecture publique, modifications réservées à l’admin."""
    permission_classes = [ReadOnlyOrAdmin]
    queryset = Card.objects.select_related("match", "player", "club")
    serializer_class = CardSerializer


class RoundViewSet(viewsets.ModelViewSet):
    """Lecture publique, modifications réservées à l’admin."""
    permission_classes = [ReadOnlyOrAdmin]
    queryset = Round.objects.all().order_by("id")
    serializer_class = RoundSerializer


# -------------------------------------------------------
# Endpoints "simples" pour le panneau admin (boutons .py)
# -------------------------------------------------------
def _post(request, key, default=None):
    return request.POST.get(key, default)

def _to_int(val, default=0):
    try:
        return int(val)
    except (TypeError, ValueError):
        return default

def _parse_dt(raw):
    """Parse un datetime str -> aware. Fallback: now()."""
    if not raw:
        return timezone.now()
    dt = parse_datetime(raw)
    if not dt:
        return timezone.now()
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return dt

def _resolve_club(val, allow_create=False):
    """
    Accepte un ID numérique OU un nom de club (insensible à la casse).
    Retourne None si introuvable (sauf allow_create=True => create).
    """
    if not val:
        return None
    s = str(val).strip()
    if s.isdigit():
        return Club.objects.filter(pk=int(s)).first()
    qs = Club.objects.filter(name__iexact=s)
    if qs.exists():
        return qs.first()
    return Club.objects.create(name=s) if allow_create else None

def _resolve_round(val):
    """Accepte un ID numérique OU un name (ex 'Journée 1')."""
    if not val:
        return None
    s = str(val).strip()
    if s.isdigit():
        return Round.objects.filter(pk=int(s)).first()
    return Round.objects.filter(name__iexact=s).first()


@require_POST
def ajouter_match(request):  # /api/ajouter.py
    home_val = _post(request, "home_id") or _post(request, "team1") or _post(request, "home")
    away_val = _post(request, "away_id") or _post(request, "team2") or _post(request, "away")

    home = _resolve_club(home_val, allow_create=False)
    away = _resolve_club(away_val, allow_create=False)
    if not home or not away:
        return HttpResponseBadRequest("Clubs invalides")
    if home == away:
        return HttpResponseBadRequest("Les deux équipes ne peuvent pas être identiques.")

    rnd = _resolve_round(_post(request, "journee") or _post(request, "round_id"))
    dt  = _parse_dt(_post(request, "datetime") or _post(request, "kickoff_at"))

    m = Match.objects.create(
        round=rnd,
        datetime=dt,
        home_club=home,
        away_club=away,
        home_score=_to_int(_post(request, "score1") or _post(request, "home_score"), 0),
        away_score=_to_int(_post(request, "score2") or _post(request, "away_score"), 0),
        minute=_to_int(_post(request, "minute"), 0),
        status=(_post(request, "status") or "SCHEDULED").upper(),
        venue=_post(request, "venue", "") or "",
        **({"buteur": (_post(request, "buteur") or "").strip()} if hasattr(Match, "buteur") else {}),
    )
    return JsonResponse({"ok": True, "id": m.id})


@require_POST
def modifier_match(request):  # /api/modifier.py
    mid = _post(request, "id")
    if not mid:
        return HttpResponseBadRequest("id manquant")

    m = get_object_or_404(Match, pk=mid)

    # Clubs (acceptent id/nom)
    if "home_id" in request.POST or "team1" in request.POST or "home" in request.POST:
        c = _resolve_club(_post(request, "home_id") or _post(request, "team1") or _post(request, "home"))
        if c: m.home_club = c
    if "away_id" in request.POST or "team2" in request.POST or "away" in request.POST:
        c = _resolve_club(_post(request, "away_id") or _post(request, "team2") or _post(request, "away"))
        if c: m.away_club = c

    # Scores / minute
    if "home_score" in request.POST or "score1" in request.POST:
        m.home_score = _to_int(_post(request, "home_score") or _post(request, "score1"), m.home_score)
    if "away_score" in request.POST or "score2" in request.POST:
        m.away_score = _to_int(_post(request, "away_score") or _post(request, "score2"), m.away_score)
    if "minute" in request.POST:
        m.minute = _to_int(_post(request, "minute"), m.minute)

    # Round / statut / lieu / datetime / buteur
    if "journee" in request.POST or "round_id" in request.POST:
        r = _resolve_round(_post(request, "journee") or _post(request, "round_id"))
        if r: m.round = r
    if "status" in request.POST:
        m.status = (_post(request, "status") or m.status).upper()
    if "venue" in request.POST:
        m.venue = _post(request, "venue") or ""
    if "datetime" in request.POST or "kickoff_at" in request.POST:
        m.datetime = _parse_dt(_post(request, "datetime") or _post(request, "kickoff_at"))
    if hasattr(Match, "buteur") and "buteur" in request.POST:
        m.buteur = _post(request, "buteur") or ""

    m.save()
    return JsonResponse({"ok": True})


@require_POST
def supprimer_match(request):  # /api/supprimer.py
    mid = _post(request, "id")
    if not mid:
        return HttpResponseBadRequest("id manquant")
    get_object_or_404(Match, pk=mid).delete()
    return JsonResponse({"ok": True})


@require_POST
def suspendre_match(request):  # /api/suspendre.py
    mid = _post(request, "id")
    if not mid:
        return HttpResponseBadRequest("id manquant")
    m = get_object_or_404(Match, pk=mid)
    m.status = "SUSPENDED"
    m.save(update_fields=["status"])
    return JsonResponse({"ok": True, "status": m.status})


# -------------------------------------------------------
# Classement provisoire (logos inclus)
# -------------------------------------------------------
@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def standings_view(request):
    """
    GET /api/stats/standings/?include_live=1
    - FT/FINISHED toujours comptés
    - + LIVE/HT/PAUSED si include_live=1 (classement qui bouge pendant le match)
    """
    include_live = str(request.query_params.get("include_live", "0")).lower() in {"1", "true", "yes", "on"}
    finished = ["FT", "FINISHED"]
    liveish  = ["LIVE", "HT", "PAUSED"]
    statuses = finished + (liveish if include_live else [])

    def _abs_logo(club):
        if not club or not getattr(club, "logo", None):
            return None
        url = club.logo.url
        return request.build_absolute_uri(url) if request else url

    # Initialise une ligne par club
    rows = {}
    for c in Club.objects.all().order_by("name"):
        rows[c.id] = {
            "club_id": c.id,
            "club_name": c.name,
            "club_logo": _abs_logo(c),
            "played": 0, "wins": 0, "draws": 0, "losses": 0,
            "goals_for": 0, "goals_against": 0, "goal_diff": 0, "points": 0,
        }

    qs = (
        Match.objects
        .filter(status__in=statuses)
        .select_related("home_club", "away_club")
        .order_by("datetime", "id")
    )

    for m in qs:
        if not m.home_club_id or not m.away_club_id:
            continue
        h, a = m.home_club_id, m.away_club_id
        hs, as_ = int(m.home_score or 0), int(m.away_score or 0)

        rows[h]["played"] += 1
        rows[a]["played"] += 1

        rows[h]["goals_for"]     += hs
        rows[h]["goals_against"] += as_
        rows[a]["goals_for"]     += as_
        rows[a]["goals_against"] += hs

        if hs > as_:
            rows[h]["wins"] += 1; rows[a]["losses"] += 1; rows[h]["points"] += 3
        elif hs < as_:
            rows[a]["wins"] += 1; rows[h]["losses"] += 1; rows[a]["points"] += 3
        else:
            rows[h]["draws"] += 1; rows[a]["draws"] += 1
            rows[h]["points"] += 1; rows[a]["points"] += 1

    out = []
    for r in rows.values():
        r["goal_diff"] = r["goals_for"] - r["goals_against"]
        out.append(r)

    # Tri standard: Pts, Diff, BM, puis nom
    out.sort(key=lambda x: (-x["points"], -x["goal_diff"], -x["goals_for"], x["club_name"].lower()))
    return Response(out)
