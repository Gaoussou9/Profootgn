
from django.db import models
from clubs.models import Club
from players.models import Player

MATCH_STATUS = [
    ('SCHEDULED','Scheduled'),
    ('LIVE','Live'),
    ('FINISHED','Finished'),
]

class Round(models.Model):
    name = models.CharField(max_length=50)  # e.g., "Journée 1"
    date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.name

class Match(models.Model):
    round = models.ForeignKey(Round, on_delete=models.SET_NULL, null=True, related_name='matches')
    datetime = models.DateTimeField()
    home_club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='home_matches')
    away_club = models.ForeignKey(Club, on_delete=models.CASCADE, related_name='away_matches')
    home_score = models.PositiveIntegerField(default=0)
    away_score = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=10, choices=MATCH_STATUS, default='SCHEDULED')
    minute = models.PositiveIntegerField(default=0)  # for live

    venue = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ['datetime']

    def __str__(self):
        return f"{self.home_club} vs {self.away_club}"

class Goal(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='goals')
    player = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True)
    club = models.ForeignKey(Club, on_delete=models.CASCADE)
    minute = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.player} {self.minute}'"

CARD_TYPES = [('Y','Yellow'),('R','Red')]
class Card(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='cards')
    player = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True)
    club = models.ForeignKey(Club, on_delete=models.CASCADE)
    minute = models.PositiveIntegerField()
    type = models.CharField(max_length=1, choices=CARD_TYPES)

    def __str__(self):
        return f"{self.player} {self.get_type_display()} {self.minute}'"
