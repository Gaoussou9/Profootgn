# matches/serializers.py
from rest_framework import serializers
from .models import Match, Goal, Card, Round


class RoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Round
        fields = "__all__"


# ---------- GOALS ----------
class GoalSerializer(serializers.ModelSerializer):
    # FK renvoyées en ids (par défaut), on ajoute des helpers lisibles :
    player_name  = serializers.SerializerMethodField()
    assist_name  = serializers.SerializerMethodField()
    club_name    = serializers.SerializerMethodField()
    club_logo    = serializers.SerializerMethodField()

    class Meta:
        model  = Goal
        fields = "__all__"  # on garde tous les champs + ceux ci-dessus

    def get_player_name(self, obj):
        p = getattr(obj, "player", None)
        if not p:
            # tente champs dénormalisés éventuels
            fn = getattr(obj, "player_first_name", "") or ""
            ln = getattr(obj, "player_last_name", "") or ""
            full = f"{fn} {ln}".strip()
            return full or None
        return getattr(p, "name", None) or f"{getattr(p,'first_name','')} {getattr(p,'last_name','')}".strip() or f"Joueur #{p.pk}"

    def get_assist_name(self, obj):
        # supporte plusieurs schémas possibles
        if getattr(obj, "assist_name", None):
            return obj.assist_name
        # texte libre ?
        if getattr(obj, "assist", None):
            return obj.assist
        # FK ?
        ap = getattr(obj, "assist_player", None)
        if ap:
            return getattr(ap, "name", None) or f"{getattr(ap,'first_name','')} {getattr(ap,'last_name','')}".strip()
        # champs dénormalisés ?
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
    # si ton modèle a déjà un champ "color" ou "card_type", on le laisse passer tel quel avec "__all__"
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
        return getattr(p, "name", None) or f"{getattr(p,'first_name','')} {getattr(p,'last_name','')}".strip() or f"Joueur #{p.pk}"

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

    home_club_name = serializers.CharField(source="home_club.name", read_only=True)
    away_club_name = serializers.CharField(source="away_club.name", read_only=True)
    home_club_logo = serializers.SerializerMethodField()
    away_club_logo = serializers.SerializerMethodField()

    class Meta:
        model  = Match
        fields = [
            "id", "round", "datetime",
            "home_club", "home_club_name", "home_club_logo",
            "away_club", "away_club_name", "away_club_logo",
            "home_score", "away_score",
            "status", "minute", "venue",
            "buteur",          # si tu l'utilises encore
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
