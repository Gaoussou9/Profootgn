# matches/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    MatchViewSet, GoalViewSet, CardViewSet, RoundViewSet,
    ajouter_match, modifier_match, supprimer_match, suspendre_match,
    standings_view,
)

router = DefaultRouter()
router.register(r"matches", MatchViewSet, basename="match")
router.register(r"goals",   GoalViewSet,  basename="goal")
router.register(r"cards",   CardViewSet,  basename="card")
router.register(r"rounds",  RoundViewSet, basename="round")

urlpatterns = [
    path("", include(router.urls)),

    # Stats
    path("stats/standings/", standings_view, name="stats-standings"),

    # Boutons admin (compat)
    path("ajouter.py",   ajouter_match,   name="admin-ajouter-match"),
    path("modifier.py",  modifier_match,  name="admin-modifier-match"),
    path("supprimer.py", supprimer_match, name="admin-supprimer-match"),
    path("suspendre.py", suspendre_match, name="admin-suspendre-match"),
]
