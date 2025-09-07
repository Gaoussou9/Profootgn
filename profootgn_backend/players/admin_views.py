# players/admin_views.py
from django.contrib import admin, messages
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render, redirect

from clubs.models import Club
from .models import Player


def _clamp(model, field_name, value):
    """Découpe value suivant max_length du champ si défini."""
    s = (value or "").strip()
    try:
        max_len = model._meta.get_field(field_name).max_length
    except Exception:
        max_len = None
    return s[:max_len] if max_len else s


PHOTO_FIELDS = (
    "photo", "image", "avatar", "picture", "profile_image", "profile_photo"
)

def _assign_photo(player, request):
    """
    Affecte une image depuis request.FILES au 1er champ photo existant sur Player.
    Supporte un bouton 'clear_photo' pour effacer l’image.
    """
    # effacer ?
    if request.POST.get("clear_photo") == "1":
        for f in PHOTO_FIELDS:
            if hasattr(player, f):
                file_field = getattr(player, f, None)
                if file_field:
                    # supprime le fichier du disque (en dev) puis vide la FK
                    try:
                        file_field.delete(save=False)
                    except Exception:
                        pass
                    setattr(player, f, None)
        return

    # téléversement ?
    uploaded = (
        request.FILES.get("photo")
        or request.FILES.get("image")
        or request.FILES.get("avatar")
        or request.FILES.get("picture")
        or request.FILES.get("profile_image")
        or request.FILES.get("profile_photo")
    )
    if uploaded:
        for f in PHOTO_FIELDS:
            if hasattr(player, f):
                setattr(player, f, uploaded)
                break


@staff_member_required
def quick_add_players_view(request):
    pos_max = getattr(Player._meta.get_field("position"), "max_length", 64)

    # suppression
    if request.method == "POST" and request.POST.get("delete_id"):
        pid = request.POST.get("delete_id")
        p = Player.objects.filter(pk=pid).first()
        if p:
            p.delete()
            messages.success(request, f"Joueur #{pid} supprimé.")
        else:
            messages.error(request, "Joueur introuvable.")
        return redirect("admin_quick_players")

    if request.method == "POST":
        pid        = (request.POST.get("id") or "").strip()
        name       = _clamp(Player, "name",       request.POST.get("name"))
        first_name = _clamp(Player, "first_name", request.POST.get("first_name"))
        last_name  = _clamp(Player, "last_name",  request.POST.get("last_name"))
        position   = _clamp(Player, "position",   request.POST.get("position"))
        number_raw = (request.POST.get("number") or "").strip()

        # club: id (hidden) OU nom saisi (input visible)
        club = None
        club_id   = (request.POST.get("club") or "").strip()
        club_name = (request.POST.get("club_name") or "").strip()
        if club_id.isdigit():
            club = Club.objects.filter(pk=int(club_id)).first()
        if not club and club_name:
            club = Club.objects.filter(name__iexact=club_name).first()

        # créer / éditer
        if pid:
            player = Player.objects.filter(pk=pid).first()
            if not player:
                messages.error(request, f"Joueur #{pid} introuvable.")
                return redirect("admin_quick_players")
        else:
            player = Player()

        # assignations
        if hasattr(player, "name"):       player.name = name
        if hasattr(player, "first_name"): player.first_name = first_name
        if hasattr(player, "last_name"):  player.last_name = last_name
        if hasattr(player, "position"):   player.position = position
        if club and hasattr(player, "club"): player.club = club
        if number_raw and hasattr(player, "number"):
            try:
                player.number = int(number_raw)
            except ValueError:
                pass

        # image
        _assign_photo(player, request)

        player.save()
        messages.success(
            request,
            f"Joueur {'créé' if not pid else 'mis à jour'} (#{player.id})."
        )
        return redirect("admin_quick_players")

    players = Player.objects.select_related("club").order_by("-id")[:50]
    ctx = {
        "players": players,
        "pos_max": pos_max,  # pour maxlength côté template
    }
    ctx |= admin.site.each_context(request)
    return render(request, "admin/players/quick_add.html", ctx)
