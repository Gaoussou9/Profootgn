# players/views.py
from rest_framework import viewsets, filters
from django.db.models import Q

from .models import Player
from .serializers import PlayerSerializer


class PlayerViewSet(viewsets.ModelViewSet):
    """
    /api/players/
      - ?club=<id>            → ne renvoie que les joueurs de ce club
      - ?club_id=<id>         → alias
      - ?club=<id1,id2,...>   → plusieurs clubs possibles
      - search, ordering      → inchangés
    """
    queryset = Player.objects.select_related("club").all()
    serializer_class = PlayerSerializer

    # Recherche / tri existants
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "nationality", "club__name"]
    ordering_fields = ["last_name", "number"]
    ordering = ["last_name"]

    def get_queryset(self):
        qs = super().get_queryset()

        # Récup du param club
        raw = self.request.query_params.get("club") or self.request.query_params.get("club_id")
        if raw:
            # support "1" ou "1,2,3"
            ids = [s.strip() for s in str(raw).split(",") if s.strip().isdigit()]
            if ids:
                qs = qs.filter(club_id__in=ids)

        return qs
