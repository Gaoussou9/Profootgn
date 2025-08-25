# matches/admin.py
from django.contrib import admin
from .models import Match, Round, Goal, Card


class GoalInline(admin.TabularInline):
    model = Goal
    extra = 0
    fields = ("club", "player", "minute")


class CardInline(admin.TabularInline):
    model = Card
    extra = 0
    fields = ("club", "player", "type", "minute")


@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "round",
        "datetime",
        "home_club",
        "away_club",
        "home_score",
        "away_score",
        "status",
        "minute",
    )
    list_filter = ("status", "round")
    search_fields = ("home_club__name", "away_club__name", "venue")
    ordering = ("datetime", "id")
    inlines = [GoalInline, CardInline]


@admin.register(Round)
class RoundAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "date")
    search_fields = ("name",)
    ordering = ("id",)


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ("id", "match", "club", "player", "minute")
    list_filter = ("club", "match__round")
    search_fields = ("player__name", "player__first_name", "player__last_name")
    ordering = ("id",)


@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    list_display = ("id", "match", "club", "player", "type", "minute")
    list_filter = ("type", "club", "match__round")
    search_fields = ("player__name", "player__first_name", "player__last_name")
    ordering = ("id",)
