
from django.db import models

class Club(models.Model):
    name = models.CharField(max_length=120, unique=True)
    short_name = models.CharField(max_length=50, blank=True)
    city = models.CharField(max_length=100, blank=True)
    founded = models.DateField(null=True, blank=True)
    stadium = models.CharField(max_length=120, blank=True)
    logo = models.ImageField(upload_to='logos/', blank=True, null=True)
    president = models.CharField(max_length=120, blank=True)
    coach = models.CharField(max_length=120, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
