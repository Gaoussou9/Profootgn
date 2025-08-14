# clubs/admin.py
from django.contrib import admin
from .models import Club

@admin.register(Club)
class ClubAdmin(admin.ModelAdmin):
    list_display = ("name",)  # ajoute d'autres champs si tu veux
    search_fields = ("name", "short_name")  # adapte selon ton modèle
