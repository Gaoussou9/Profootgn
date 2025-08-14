
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Count, Q, F, IntegerField, Sum
from matches.models import Match, Goal
from clubs.models import Club
from players.models import Player
from .serializers import StandingRowSerializer, TopScorerSerializer

class StandingsView(APIView):
    def get(self, request):
        # Aggregate basic stats from finished matches
        clubs = Club.objects.all()
        rows = []
        for club in clubs:
            home = Match.objects.filter(home_club=club, status='FINISHED')
            away = Match.objects.filter(away_club=club, status='FINISHED')
            played = home.count() + away.count()
            wins = home.filter(home_score__gt=F('away_score')).count() + away.filter(away_score__gt=F('home_score')).count()
            draws = home.filter(home_score=F('away_score')).count() + away.filter(home_score=F('away_score')).count()
            losses = played - wins - draws
            gf = home.aggregate(s=Sum('home_score'))['s'] or 0
            gf += away.aggregate(s=Sum('away_score'))['s'] or 0
            ga = home.aggregate(s=Sum('away_score'))['s'] or 0
            ga += away.aggregate(s=Sum('home_score'))['s'] or 0
            points = wins*3 + draws*1
            rows.append({
                'club_id': club.id,
                'club_name': club.name,
                'played': played,
                'wins': wins,
                'draws': draws,
                'losses': losses,
                'goals_for': gf,
                'goals_against': ga,
                'goal_diff': gf-ga,
                'points': points
            })
        # Sort: points desc, goal diff desc, goals for desc
        rows.sort(key=lambda r: (r['points'], r['goal_diff'], r['goals_for']), reverse=True)
        return Response(rows)

class TopScorersView(APIView):
    def get(self, request):
        # count goals per player
        data = (
            Goal.objects
            .values('player_id', 'player__first_name', 'player__last_name', 'club__name')
            .annotate(goals=Count('id'))
            .order_by('-goals', 'player__last_name')
        )
        res = []
        for row in data:
            full_name = (row.get('player__first_name') or '') + ' ' + (row.get('player__last_name') or '')
            res.append({
                'player_id': row['player_id'],
                'player_name': full_name.strip(),
                'club_name': row['club__name'],
                'goals': row['goals']
            })
        return Response(res)
