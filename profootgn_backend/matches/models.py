# matches/models.py
from django.db import models
from django.core.exceptions import ValidationError
from clubs.models import Club
from players.models import Player

MATCH_STATUS = [
    ('SCHEDULED', 'Scheduled'),
    ('LIVE', 'Live'),
    ('FINISHED', 'Finished'),
    ('SUSPENDED', 'Suspended'),  # ajouté
]

class Round(models.Model):
    name = models.CharField(max_length=50)  # e.g., "Journée 1"
    date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return self.name


class Match(models.Model):
    round = models.ForeignKey(
        Round, on_delete=models.SET_NULL, null=True, related_name='matches'
    )
    datetime = models.DateTimeField()
    home_club = models.ForeignKey(
        Club, on_delete=models.CASCADE, related_name='home_matches'
    )
    away_club = models.ForeignKey(
        Club, on_delete=models.CASCADE, related_name='away_matches'
    )
    home_score = models.PositiveIntegerField(default=0)
    away_score = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=10, choices=MATCH_STATUS, default='SCHEDULED')
    minute = models.PositiveIntegerField(default=0)  # for live
    venue = models.CharField(max_length=120, blank=True)

    # champ texte libre pour l’admin
    buteur = models.CharField(
        max_length=120,
        blank=True,
        default="",
        help_text="Nom du buteur principal",
    )

    class Meta:
        ordering = ['datetime']
        constraints = [
            # 1) interdit home == away
            models.CheckConstraint(
                check=~models.Q(home_club=models.F('away_club')),
                name='match_home_neq_away',
            ),
            # 2) pas de doublon EXACT (même sens) pour une journée
            models.UniqueConstraint(
                fields=['round', 'home_club', 'away_club'],
                name='uniq_round_home_away_in_round',
            ),
        ]

    def clean(self):
        """
        Bonus : empêche aussi le doublon INVERSÉ (A-B et B-A) dans la même journée.
        Cette validation applicative complète la contrainte DB ci-dessus.
        """
        super().clean()

        if self.home_club_id and self.away_club_id and self.home_club_id == self.away_club_id:
            raise ValidationError("Le club à domicile ne peut pas être identique au club à l'extérieur.")

        if self.round_id and self.home_club_id and self.away_club_id:
            qs = Match.objects.filter(round_id=self.round_id)
            if self.pk:
                qs = qs.exclude(pk=self.pk)

            exists_same = qs.filter(
                home_club_id=self.home_club_id, away_club_id=self.away_club_id
            ).exists()
            exists_reverse = qs.filter(
                home_club_id=self.away_club_id, away_club_id=self.home_club_id
            ).exists()

            if exists_same or exists_reverse:
                raise ValidationError("Une affiche entre ces deux clubs existe déjà pour cette journée (même sens ou inversée).")

    def __str__(self):
        return f"{self.home_club} vs {self.away_club}"


class Goal(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='goals')
    player = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True)
    club = models.ForeignKey(Club, on_delete=models.CASCADE)
    minute = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.player} {self.minute}'"


CARD_TYPES = [('Y', 'Yellow'), ('R', 'Red')]

class Card(models.Model):
    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='cards')
    player = models.ForeignKey(Player, on_delete=models.SET_NULL, null=True, blank=True)
    club = models.ForeignKey(Club, on_delete=models.CASCADE)
    minute = models.PositiveIntegerField()
    type = models.CharField(max_length=1, choices=CARD_TYPES)

    def __str__(self):
        return f"{self.player} {self.get_type_display()} {self.minute}'"
