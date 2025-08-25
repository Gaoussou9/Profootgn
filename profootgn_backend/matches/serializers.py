# matches/serializers.py
from rest_framework import serializers
from .models import Match, Goal, Card, Round


class RoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Round
        fields = "__all__"


# ---------- GOALS ----------
class GoalSerializer(serializers.ModelSerializer):
    # Helpers lisibles
    player_name = serializers.SerializerMethodField()
    assist_name = serializers.SerializerMethodField()
    club_name   = serializers.SerializerMethodField()
    club_logo   = serializers.SerializerMethodField()

    class Meta:
        model  = Goal
        fields = "__all__"  # tous les champs natifs + les 4 ci-dessus

    def get_player_name(self, obj):
        p = getattr(obj, "player", None)
        if not p:
            fn = getattr(obj, "player_first_name", "") or ""
            ln = getattr(obj, "player_last_name", "") or ""
            full = f"{fn} {ln}".strip()
            return full or None
        return (
            getattr(p, "name", None)
            or f"{getattr(p, 'first_name', '')} {getattr(p, 'last_name', '')}".strip()
            or f"Joueur #{p.pk}"
        )

    def get_assist_name(self, obj):
        # accepte plusieurs schémas (texte libre, FK, champs dénormalisés)
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
        logo = getattr(c, "logo", None) if c else None
        if not logo:
            return None
        url = logo.url
        return request.build_absolute_uri(url) if request else url


# ---------- CARDS ----------
class CardSerializer(serializers.ModelSerializer):
    player_name = serializers.SerializerMethodField()
    club_name   = serializers.SerializerMethodField()
    club_logo   = serializers.SerializerMethodField()

    class Meta:
        model  = Card
        fields = "__all__"

    def get_player_name(self, obj):
        p = getattr(obj, "player", None)
        if not p:
            fn = getattr(obj, "player_first_name", "") or ""
            ln = getattr(obj, "player_last_name", "") or ""
            full = f"{fn} {ln}".strip()
            return full or None
        return (
            getattr(p, "name", None)
            or f"{getattr(p, 'first_name', '')} {getattr(p, 'last_name', '')}".strip()
            or f"Joueur #{p.pk}"
        )

    def get_club_name(self, obj):
        c = getattr(obj, "club", None)
        return getattr(c, "name", None) if c else None

    def get_club_logo(self, obj):
        request = self.context.get("request")
        c = getattr(obj, "club", None)
        logo = getattr(c, "logo", None) if c else None
        if not logo:
            return None
        url = logo.url
        return request.build_absolute_uri(url) if request else url


# ---------- MATCH ----------
class MatchSerializer(serializers.ModelSerializer):
    goals = GoalSerializer(many=True, read_only=True)
    cards = CardSerializer(many=True, read_only=True)

    round_name     = serializers.CharField(source="round.name", read_only=True)
    home_club_name = serializers.CharField(source="home_club.name", read_only=True)
    away_club_name = serializers.CharField(source="away_club.name", read_only=True)
    home_club_logo = serializers.SerializerMethodField()
    away_club_logo = serializers.SerializerMethodField()

    class Meta:
        model  = Match
        fields = [
            "id", "round", "round_name", "datetime",   # ← la virgule manquait ici
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
        url = file_field.url
        return request.build_absolute_uri(url) if request else url

    def get_home_club_logo(self, obj):
        request = self.context.get("request")
        return self._abs(request, getattr(obj.home_club, "logo", None))

    def get_away_club_logo(self, obj):
        request = self.context.get("request")
        return self._abs(request, getattr(obj.away_club, "logo", None))
