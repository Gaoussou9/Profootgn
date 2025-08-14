from django.contrib import admin, messages
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render, redirect
from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from clubs.models import Club
from .models import Match, Round

STATUSES = [
    ("SCHEDULED", "Non débuté"),
    ("LIVE", "En cours"),
    ("HT", "Mi-temps"),
    ("FT", "Terminé"),
    ("POST", "Reporté"),
    ("CAN", "Annulé"),
]

@staff_member_required
def quick_add_match_view(request):
    if request.method == "POST":
        home_name = (request.POST.get("home") or "").strip()
        away_name = (request.POST.get("away") or "").strip()
        home_score = int(request.POST.get("home_score") or 0)
        away_score = int(request.POST.get("away_score") or 0)
        minute = (request.POST.get("minute") or "").strip()
        status = request.POST.get("status") or "SCHEDULED"
        round_id = request.POST.get("round_id")

        # NEW: date/heure (facultatif côté formulaire)
        kickoff_raw = (request.POST.get("kickoff_at") or "").strip()
        dt = parse_datetime(kickoff_raw) if kickoff_raw else None
        if dt is None:
            dt = timezone.now()
        elif timezone.is_naive(dt):
            dt = timezone.make_aware(dt, timezone.get_current_timezone())

        if not home_name or not away_name:
            messages.error(request, "Sélectionne les deux équipes.")
            return redirect("admin_quick_match")

        if home_name == away_name:
            messages.error(request, "Les deux équipes ne peuvent pas être identiques.")
            return redirect("admin_quick_match")

        home, _ = Club.objects.get_or_create(name=home_name)
        away, _ = Club.objects.get_or_create(name=away_name)

        rnd = Round.objects.filter(id=round_id).first() if round_id else None
        if rnd is None:
            rnd = Round.objects.order_by("id").first()

        dup = Match.objects.filter(
            home_club=home, away_club=away, round=rnd
        ).filter(Q(status="SCHEDULED") | Q(status=status)).exists()
        if dup:
            messages.warning(request, "Un match identique existe déjà pour cette journée.")
            return redirect("admin_quick_match")

        Match.objects.create(
            home_club=home,
            away_club=away,
            home_score=home_score,
            away_score=away_score,
            minute=minute,
            status=status,
            round=rnd,
            datetime=dt,        # ← IMPORTANT : plus de NULL
        )
        messages.success(request, "Match ajouté avec succès.")
        return redirect("admin_quick_match")

    matches = (
        Match.objects.select_related("home_club", "away_club", "round")
        .order_by("-id")[:50]
    )

    ctx = {
        "clubs": Club.objects.order_by("name").values_list("name", flat=True),
        "rounds": Round.objects.order_by("id"),
        "STATUSES": STATUSES,
        "matches": matches,
    }
    ctx |= admin.site.each_context(request)
    return render(request, "admin/matches/quick_add.html", ctx)
