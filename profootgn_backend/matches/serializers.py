
from rest_framework import serializers
from .models import Match, Goal, Card, Round

class RoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Round
        fields = '__all__'

class GoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = '__all__'

class CardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Card
        fields = '__all__'

class MatchSerializer(serializers.ModelSerializer):
    goals = GoalSerializer(many=True, read_only=True)
    cards = CardSerializer(many=True, read_only=True)
    home_club_name = serializers.CharField(source='home_club.name', read_only=True)
    away_club_name = serializers.CharField(source='away_club.name', read_only=True)
    home_club_logo = serializers.SerializerMethodField()
    away_club_logo = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            'id','round','datetime',
            'home_club','home_club_name','home_club_logo',
            'away_club','away_club_name','away_club_logo',
            'home_score','away_score','status','minute','venue',
            'goals','cards'
        ]

    def _abs(self, request, file_field):
        if not file_field:
            return None
        url = file_field.url  # /media/clubs/...
        if request is None:
            return url
        return request.build_absolute_uri(url)

    def get_home_club_logo(self, obj):
        request = self.context.get('request')
        logo = getattr(obj.home_club, 'logo', None)
        return self._abs(request, logo) if logo else None

    def get_away_club_logo(self, obj):
        request = self.context.get('request')
        logo = getattr(obj.away_club, 'logo', None)
        return self._abs(request, logo) if logo else None