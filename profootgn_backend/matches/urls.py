# matches/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

# DRF (API publique / actions .py)
from . import views as api

# Pages admin rapides (HTML) + API JSON pour events
from .admin_views import (
    quick_add_match_view,
    quick_events,
    quick_events_api,
)

app_name = "matches"

router = DefaultRouter()
router.register(r"matches", api.MatchViewSet, basename="match")
router.register(r"goals",   api.GoalViewSet,   basename="goal")
router.register(r"cards",   api.CardViewSet,   basename="card")
router.register(r"rounds",  api.RoundViewSet,  basename="round")

urlpatterns = [
    # API REST (DRF)
    path("", include(router.urls)),

    # Actions "boutons" admin .py
    path("ajouter.py",   api.ajouter_match,   name="ajouter_match"),
    path("modifier.py",  api.modifier_match,  name="modifier_match"),
    path("supprimer.py", api.supprimer_match, name="supprimer_match"),
    path("suspendre.py", api.suspendre_match, name="suspendre_match"),

    # Stats & recherche
    path("stats/standings/", api.standings_view, name="standings"),
    path("players/search/",  api.search_players, name="players_search"),

    # Pages admin rapides (HTML)
    path("admin/quick/",       quick_add_match_view, name="admin_quick_match"),
    path("admin/events/",      quick_events,         name="admin_quick_events"),
    # API JSON des events (list/update/delete/upload)
    path("admin/events/api/",  quick_events_api,     name="admin_quick_events_api"),
]
