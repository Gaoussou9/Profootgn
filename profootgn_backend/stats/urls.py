# stats/urls.py
from django.urls import path
from .views import StandingsView, TopScorersView

urlpatterns = [
    path('standings/', StandingsView.as_view(), name='stats-standings'),
    path('topscorers/', TopScorersView.as_view(), name='stats-topscorers'),
]
