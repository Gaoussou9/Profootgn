# matches/admin.py
from django.contrib import admin
from django.utils.html import format_html

from .models import Match, Goal, Card, Round
from clubs.models import Club


def has_field(model, name: str) -> bool:
    return any(getattr(f, "name", None) == name for f in model._meta.get_fields())


# ---------- Inlines sur la page d’un match ----------
class GoalInline(admin.TabularInline):
    model = Goal
    extra = 0

    # champs dynamiques selon ton modèle
    def get_fields(self, request, obj=None):
        fields = ["minute", "club", "player"]
        if has_field(Goal, "assist_player"):
            fields.append("assist_player")
        return fields

    # évite admin.E040 (pas besoin d'autocomplete_fields)
    def get_raw_id_fields(self, request, obj=None):
        ids = ["club", "player"]
        if has_field(Goal, "assist_player"):
            ids.append("assist_player")
        return ids


class CardInline(admin.TabularInline):
    model = Card
    extra = 0

    def get_fields(self, request, obj=None):
        fields = ["minute", "club", "player"]
        if has_field(Card, "color"):
            fields.append("color")
        if has_field(Card, "card_type"):
            fields.append("card_type")
        return fields

    def get_raw_id_fields(self, request, obj=None):
        return ["club", "player"]


# ---------- Admin Match ----------
@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "round",
        "datetime",
        "home_club",
        "home_score",
        "away_score",
        "away_club",
        "status",
        "minute",
    )
    list_filter = ("status", "round", "datetime")
    search_fields = ("home_club__name", "away_club__name", "venue")
    date_hierarchy = "datetime"
    inlines = [GoalInline, CardInline]

    # si tu as ce template (sinon commente la ligne)
    change_list_template = "admin/matches/change_list_with_quick.html"


# ---------- Admin Goal ----------
@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    ordering = ("-id",)

    def get_list_display(self, request):
        cols = ["id", "match", "club", "minute", "player"]
        if has_field(Goal, "assist_player"):
            cols.append("assist_player")
        return cols

    list_filter = ("club", "match")
    # champs de recherche robustes (si Player a name/first/last, ça marche ;
    # sinon Django ignore les lookups inexistants)
    search_fields = (
        "player__name",
        "player__first_name",
        "player__last_name",
        "assist_player__name",
        "assist_player__first_name",
        "assist_player__last_name",
    )

    def get_raw_id_fields(self, request):
        ids = ["match", "club", "player"]
        if has_field(Goal, "assist_player"):
            ids.append("assist_player")
        return ids

    # Permet /admin/matches/goal/add/?match=12&club=3&minute=44
    def get_changeform_initial_data(self, request):
        initial = super().get_changeform_initial_data(request)
        m = request.GET.get("match")
        c = request.GET.get("club")
        minute = request.GET.get("minute")
        if m and m.isdigit():
            initial["match"] = int(m)
        if c and c.isdigit():
            initial["club"] = int(c)
        if minute and minute.isdigit():
            initial["minute"] = int(minute)
        return initial


# ---------- Admin Card ----------
@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    ordering = ("-id",)

    def get_list_display(self, request):
        cols = ["id", "match", "club", "minute", "player"]
        if has_field(Card, "color"):
            cols.append("color")
        if has_field(Card, "card_type"):
            cols.append("card_type")
        return cols

    def get_list_filter(self, request):
        flt = ["club", "match"]
        if has_field(Card, "color"):
            flt.insert(0, "color")
        return flt

    # Django lit list_filter comme attribut ; on redirige vers la méthode
    @property
    def list_filter(self):
        # renvoyé à l'instanciation du ModelAdmin via descriptor
        return self.get_list_filter(None)

    search_fields = (
        "player__name",
        "player__first_name",
        "player__last_name",
    )

    def get_raw_id_fields(self, request):
        return ["match", "club", "player"]

    # /admin/matches/card/add/?match=12&club=3&minute=17&color=YELLOW
    def get_changeform_initial_data(self, request):
        initial = super().get_changeform_initial_data(request)
        m = request.GET.get("match")
        c = request.GET.get("club")
        minute = request.GET.get("minute")
        color = request.GET.get("color")
        if m and m.isdigit():
            initial["match"] = int(m)
        if c and c.isdigit():
            initial["club"] = int(c)
        if minute and minute.isdigit():
            initial["minute"] = int(minute)
        if color and has_field(Card, "color"):
            initial["color"] = color
        return initial


# ---------- Admin Round ----------
@admin.register(Round)
class RoundAdmin(admin.ModelAdmin):
    # 'number' n'existe pas chez toi → on n'affiche que ce qui est sûr
    list_display = ("id", "name")
    search_fields = ("name",)
    ordering = ("id",)
