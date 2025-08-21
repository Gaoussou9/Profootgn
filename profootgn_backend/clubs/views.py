from rest_framework import viewsets, filters, permissions
from .models import Club
from .serializers import ClubSerializer

class ReadOnlyOrAdmin(permissions.IsAdminUser):
    """GET/HEAD/OPTIONS publics, écritures réservées admin."""
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return super().has_permission(request, view)

class ClubViewSet(viewsets.ModelViewSet):
    queryset = Club.objects.all().order_by("name")
    serializer_class = ClubSerializer
    permission_classes = [ReadOnlyOrAdmin]

    # Recherche & tri (adapte les champs à ceux qui existent dans ton modèle)
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]  # ajoute "city", "coach", etc. uniquement s'ils existent
    ordering_fields = ["name", "id"]
    ordering = ["name"]

    # Pour le picker: renvoyer une liste (pas de pagination)
    pagination_class = None
