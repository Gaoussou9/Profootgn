# matches/views.py
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.db.models import Prefetch
from rest_framework import viewsets, filters, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Match, Goal, Card, Round
from .serializers import (
    MatchSerializer,
    GoalSerializer,
    CardSerializer,
    RoundSerializer,
)


class ReadOnlyOrAdmin(permissions.IsAdminUser):
    """
    - GET/HEAD/OPTIONS : public
    - POST/PUT/PATCH/DELETE : admin uniquement
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return super().has_permission(request, view)


class MatchViewSet(viewsets.ModelViewSet):
    """
    Endpoints:
      - /api/matches/            (liste filtrable/paginée)
      - /api/matches/{id}/
      - /api/matches/recent/     (terminés récents)
      - /api/matches/upcoming/   (programmés à venir)
      - /api/matches/live/       (en cours + mi-temps)
    """
    permission_classes = [ReadOnlyOrAdmin]
    serializer_class = MatchSerializer

    # Recherche & tri
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["home_club__name", "away_club__name", "venue"]
    ordering_fields = ["datetime", "minute", "id"]
    ordering = ["-datetime", "-id"]

    def get_queryset(self):
        """
        Précharge relations pour éviter N+1 et applique filtres query string:
          - status: accepte FINISHED ⇔ FT, LIVE inclut aussi HT
          - date_from/date_to: au format YYYY-MM-DD (sur la date de 'datetime')
        """
        qs = (
            Match.objects
            .select_related("home_club", "away_club", "round")
            .prefetch_related(
                Prefetch("goals", queryset=Goal.objects.select_related("player", "club")),
                Prefetch("cards", queryset=Card.objects.select_related("player", "club")),
            )
        )

        status = self.request.query_params.get("status")
        date_from = self.request.query_params.get("date_from")  # YYYY-MM-DD
        date_to   = self.request.query_params.get("date_to")    # YYYY-MM-DD

        if status:
            s = status.upper()
            if s == "FINISHED":
                qs = qs.filter(status__in=["FT", "FINISHED"])
            elif s == "LIVE":
                qs = qs.filter(status__in=["LIVE", "HT"])  # inclure la mi-temps
            else:
                qs = qs.filter(status=s)

        if date_from:
            d = parse_date(date_from)
            if d:
                qs = qs.filter(datetime__date__gte=d)
        if date_to:
            d = parse_date(date_to)
            if d:
                qs = qs.filter(datetime__date__lte=d)

        return qs

    # -------- Actions pratiques pour le front -------- #

    @action(detail=False, methods=["get"])
    def recent(self, request):
        """
        Matchs terminés récents (non paginés)
        Paramètres:
          - page_size / limit (optionnel, défaut 10)
        """
        limit = int(request.query_params.get("page_size") or request.query_params.get("limit") or 10)
        qs = (
            self.get_queryset()
            .filter(status__in=["FT", "FINISHED"])
            .order_by("-datetime", "-id")[:limit]
        )
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def upcoming(self, request):
        """
        Matchs programmés à venir (non paginés)
        Paramètres:
          - page_size / limit (optionnel, défaut 10)
        """
        limit = int(request.query_params.get("page_size") or request.query_params.get("limit") or 10)
        now = timezone.now()
        qs = (
            self.get_queryset()
            .filter(status="SCHEDULED", datetime__gte=now)
            .order_by("datetime", "id")[:limit]
        )
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def live(self, request):
        """
        Matchs en cours (inclut la mi-temps).
        """
        qs = (
            self.get_queryset()
            .filter(status__in=["LIVE", "HT"])
            .order_by("-datetime", "-id")
        )
        return Response(self.get_serializer(qs, many=True).data)


class GoalViewSet(viewsets.ModelViewSet):
    """
    Lecture publique, modifications réservées à l’admin.
    """
    permission_classes = [ReadOnlyOrAdmin]
    queryset = Goal.objects.select_related("match", "player", "club")
    serializer_class = GoalSerializer


class CardViewSet(viewsets.ModelViewSet):
    """
    Lecture publique, modifications réservées à l’admin.
    """
    permission_classes = [ReadOnlyOrAdmin]
    queryset = Card.objects.select_related("match", "player", "club")
    serializer_class = CardSerializer


class RoundViewSet(viewsets.ModelViewSet):
    """
    Lecture publique, modifications réservées à l’admin.
    """
    permission_classes = [ReadOnlyOrAdmin]
    queryset = Round.objects.all().order_by("id")
    serializer_class = RoundSerializer
