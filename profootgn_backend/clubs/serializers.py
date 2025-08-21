from rest_framework import serializers
from .models import Club

class ClubSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Club
        # ajoute d'autres champs si tu en as besoin
        fields = ["id", "name", "logo_url"]

    def get_logo_url(self, obj):
        logo = getattr(obj, "logo", None)
        if not logo:
            return None
        request = self.context.get("request")
        url = logo.url
        return request.build_absolute_uri(url) if request else url
