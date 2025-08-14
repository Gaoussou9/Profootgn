from django.contrib import admin
from .models import Match, Goal, Card, Round

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ("datetime", "home_club", "home_score", "away_score", "away_club", "status")
    list_filter = ("status", "datetime", "round")
    # requis si on utilise autocomplete_fields :
    search_fields = ("home_club__name", "away_club__name", "venue")
    date_hierarchy = "datetime"
    autocomplete_fields = ("home_club", "away_club", "round")
    change_list_template = "admin/matches/match_changelist.html"

@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    # 'player_name' -> remplace par 'player'
    list_display = ("match", "club", "player", "minute")
    list_filter = ("club",)
    search_fields = ("player__first_name", "player__last_name", "club__name")

@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    # 'player_name' -> 'player' ; 'card_type' -> 'type'
    list_display = ("match", "club", "player", "type", "minute")
    list_filter = ("type", "club")
    search_fields = ("player__first_name", "player__last_name", "club__name")

@admin.register(Round)
class RoundAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
