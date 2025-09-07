from rest_framework import serializers
from .models import Match, Goal, Card, Round

# On récupère dynamiquement le nom du manager inverse :
GOALS_REL_NAME = Goal._meta.get_field("match").remote_field.get_accessor_name()   # goals ou goal_set
CARDS_REL_NAME = Card._meta.get_field("match").remote_field.get_accessor_name()   # cards ou card_set


class RoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Round
        fields = "__all__"


# ---------- GOALS ----------
class GoalSerializer(serializers.ModelSerializer):
    # Helpers lisibles
    player_name  = serializers.SerializerMethodField()
    assist_name  = serializers.SerializerMethodField()
    club_name    = serializers.SerializerMethodField()
    club_logo    = serializers.SerializerMethodField()
    player_photo = serializers.SerializerMethodField()

    # Flags & type pour pen/csc
    is_penalty   = serializers.SerializerMethodField()
    is_own_goal  = serializers.SerializerMethodField()
    type         = serializers.SerializerMethodField()

    class Meta:
        model = Goal
        fields = "__all__"  # inclut aussi les champs ci-dessus

    # ----------- helpers d'URL absolue -----------
    def _abs(self, request, file_field):
        if not file_field:
            return None
        try:
            url = file_field.url
        except Exception:
            return None
        return request.build_absolute_uri(url) if request else url

    # ----------- champs lisibles -----------
    def get_player_name(self, obj):
        p = getattr(obj, "player", None)
        if p:
            full = getattr(p, "name", None) or f"{getattr(p, 'first_name', '')} {getattr(p, 'last_name', '')}".strip()
            return full or f"Joueur #{getattr(p, 'pk', '')}"
        fn = getattr(obj, "player_first_name", "") or ""
        ln = getattr(obj, "player_last_name", "") or ""
        full = f"{fn} {ln}".strip()
        return full or None

    def get_assist_name(self, obj):
        # priorité au texte libre si présent
        if getattr(obj, "assist_name", None):
            return obj.assist_name
        if getattr(obj, "assist", None):
            return obj.assist
        ap = getattr(obj, "assist_player", None)
        if ap:
            return getattr(ap, "name", None) or f"{getattr(ap, 'first_name', '')} {getattr(ap, 'last_name', '')}".strip()
        fn = getattr(obj, "assist_player_first_name", "") or ""
        ln = getattr(obj, "assist_player_last_name", "") or ""
        full = f"{fn} {ln}".strip()
        return full or None

    def get_club_name(self, obj):
        c = getattr(obj, "club", None)
        return getattr(c, "name", None) if c else None

    def get_club_logo(self, obj):
        request = self.context.get("request")
        c = getattr(obj, "club", None)
        file_field = getattr(c, "logo", None) if c else None
        return self._abs(request, file_field)

    def get_player_photo(self, obj):
        request = self.context.get("request")
        p = getattr(obj, "player", None)
        file_field = getattr(p, "photo", None) if p else None
        return self._abs(request, file_field)

    # ----------- flags pen/csc -----------
    def get_is_penalty(self, obj):
        # booleans tolérants
        for n in ("is_penalty", "penalty", "on_penalty"):
            if hasattr(obj, n):
                return bool(getattr(obj, n))
        # fallback via type/kind
        t = (getattr(obj, "type", "") or getattr(obj, "kind", "") or "").upper()
        return t in {"PEN", "P", "PK", "PENALTY"}

    def get_is_own_goal(self, obj):
        for n in ("is_own_goal", "own_goal", "og"):
            if hasattr(obj, n):
                return bool(getattr(obj, n))
        t = (getattr(obj, "type", "") or getattr(obj, "kind", "") or "").upper()
        return t in {"OG", "CSC", "OWN_GOAL", "OWNGOAL"}

    def get_type(self, obj):
        return getattr(obj, "type", None) or getattr(obj, "kind", None)


# ---------- CARDS ----------
class CardSerializer(serializers.ModelSerializer):
    player_name = serializers.SerializerMethodField()
    club_name   = serializers.SerializerMethodField()
    club_logo   = serializers.SerializerMethodField()

    class Meta:
        model = Card
        fields = "__all__"

    def _abs(self, request, file_field):
        if not file_field:
            return None
        try:
            url = file_field.url
        except Exception:
            return None
        return request.build_absolute_uri(url) if request else url

    def get_player_name(self, obj):
        p = getattr(obj, "player", None)
        if p:
            full = getattr(p, "name", None) or f"{getattr(p, 'first_name', '')} {getattr(p, 'last_name', '')}".strip()
            return full or f"Joueur #{getattr(p, 'pk', '')}"
        fn = getattr(obj, "player_first_name", "") or ""
        ln = getattr(obj, "player_last_name", "") or ""
        full = f"{fn} {ln}".strip()
        return full or None

    def get_club_name(self, obj):
        c = getattr(obj, "club", None)
        return getattr(c, "name", None) if c else None

    def get_club_logo(self, obj):
        request = self.context.get("request")
        c = getattr(obj, "club", None)
        file_field = getattr(c, "logo", None) if c else None
        return self._abs(request, file_field)


# ---------- MATCH ----------
class MatchSerializer(serializers.ModelSerializer):
    # ⚠️ agnostique du related_name
    goals = serializers.SerializerMethodField()
    cards = serializers.SerializerMethodField()

    round_name    = serializers.CharField(source="round.name", read_only=True)
    round_number  = serializers.IntegerField(source="round.number", read_only=True)

    home_club_name = serializers.CharField(source="home_club.name", read_only=True)
    away_club_name = serializers.CharField(source="away_club.name", read_only=True)
    home_club_logo = serializers.SerializerMethodField()
    away_club_logo = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            "id",
            "round", "round_name", "round_number",
            "datetime",
            "home_club", "home_club_name", "home_club_logo",
            "away_club", "away_club_name", "away_club_logo",
            "home_score", "away_score",
            "status", "minute", "venue",
            "buteur",
            "goals", "cards",
        ]

    def _abs(self, request, file_field):
        if not file_field:
            return None
        try:
            url = file_field.url
        except Exception:
            return None
        return request.build_absolute_uri(url) if request else url

    def get_home_club_logo(self, obj):
        request = self.context.get("request")
        club = getattr(obj, "home_club", None)
        file_field = getattr(club, "logo", None) if club else None
        return self._abs(request, file_field)

    def get_away_club_logo(self, obj):
        request = self.context.get("request")
        club = getattr(obj, "away_club", None)
        file_field = getattr(club, "logo", None) if club else None
        return self._abs(request, file_field)

    def get_goals(self, obj):
        mgr = getattr(obj, GOALS_REL_NAME, None)
        if mgr is not None and hasattr(mgr, "all"):
            qs = mgr.all().select_related("player", "club").order_by("minute", "id")
        else:
            qs = Goal.objects.filter(match=obj).select_related("player", "club").order_by("minute", "id")
        return GoalSerializer(qs, many=True, context=self.context).data

    def get_cards(self, obj):
        mgr = getattr(obj, CARDS_REL_NAME, None)
        if mgr is not None and hasattr(mgr, "all"):
            qs = mgr.all().select_related("player", "club").order_by("minute", "id")
        else:
            qs = Card.objects.filter(match=obj).select_related("player", "club").order_by("minute", "id")
        return CardSerializer(qs, many=True, context=self.context).data
