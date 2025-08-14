
from rest_framework import viewsets, filters
from .models import Club
from .serializers import ClubSerializer

class ClubViewSet(viewsets.ModelViewSet):
    queryset = Club.objects.all()
    serializer_class = ClubSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name','city','coach','president']
    ordering_fields = ['name','founded']
    ordering = ['name']
