# clubs/serializers.py
from rest_framework import serializers
from .models import Club, StaffMember

class ClubSerializer(serializers.ModelSerializer):
    class Meta:
        model = Club
        fields = [
            "id", "name", "short_name", "city", "founded",
            "stadium", "logo", "president", "coach"
        ]


class ClubMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Club
        fields = ['id', 'name', 'logo']


class StaffSerializer(serializers.ModelSerializer):
    club_name = serializers.CharField(source='club.name', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = StaffMember
        fields = [
            'id','club','club_name','full_name','role',
            'role_display','phone','email','photo','is_active'
        ]
