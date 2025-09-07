# clubs/views.py
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from .models import Club
from .serializers import ClubSerializer

class ClubViewSet(viewsets.ModelViewSet):
    """
    API REST pour gérer les clubs.
    - GET /api/clubs/ → liste
    - POST /api/clubs/ → créer
    - GET /api/clubs/{id}/ → détail
    - PUT/PATCH /api/clubs/{id}/ → mise à jour
    - DELETE /api/clubs/{id}/ → suppression
    """
    queryset = Club.objects.all().order_by("name")
    serializer_class = ClubSerializer
    permission_classes = [permissions.IsAuthenticated, permissions.IsAdminUser]

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get("q")       # recherche texte
        city = self.request.query_params.get("city") # filtre ville
        if q:
            qs = qs.filter(name__icontains=q)
        if city:
            qs = qs.filter(city__icontains=city)
        return qs
