from pathlib import Path
from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")



SECRET_KEY = os.getenv('SECRET_KEY', 'change-me-in-production')
DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'jazzmin',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # 3rd party
    'rest_framework',
    'corsheaders',
    # local apps
    'clubs',
    'players',
    'matches',
    'stats',
    'news',
    'recruitment',
    'users',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'profootgn.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],  # <- important pour tes overrides admin
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'profootgn.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': os.getenv('DB_NAME', 'profootgn_db'),
        'USER': os.getenv('DB_USER', 'Admin'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'Admin'), 
        'HOST': os.getenv('DB_HOST', '127.0.0.1'),
        'PORT': os.getenv('DB_PORT', '3306'),
        'OPTIONS': {'charset': 'utf8mb4'},
    }
}


    


AUTH_PASSWORD_VALIDATORS = [
    {'NAME':'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME':'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME':'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME':'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Africa/Conakry'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
}

# CORS
CORS_ALLOW_ALL_ORIGINS = False
origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
CORS_ALLOWED_ORIGINS = [o.strip() for o in origins.split(',') if o.strip()]


from datetime import timedelta
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=6),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REST_FRAMEWORK.update({
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
})




JAZZMIN_SETTINGS = {
    "site_title": "Administration de Django",
    "site_header": "Administration de Django",
    "site_brand": "Administration de Django",
    "welcome_sign": "Tableau de bord",
    "copyright": "LiveFootGn",

    # Menu du haut (liens rapides)
    "topmenu_links": [
        {"name": "Accueil", "url": "admin:index", "permissions": ["auth.view_user"]},
        {"app": "players"},
        {"app": "clubs"},
        {"app": "matches"},
        {"app": "recruitment"},
        {"app": "users"},
        # lien vers ta page admin custom (voir §4)
        {"name": "Espace Admin LiveFootGn", "url": "admin_livefootgn"},
    ],

    # Ordre des apps et des modèles (colonne centrale, cartes)
    "order_with_respect_to": [
        "auth", "players", "clubs", "matches", "stats", "news", "recruitment", "users"
    ],

    # Icônes (gauche + cartes) — FontAwesome (fa)
    "icons": {
        "auth": "fas fa-shield-alt",
        "auth.Group": "fas fa-users-cog",
        "auth.User": "fas fa-user",
        "players": "fas fa-user-friends",
        "players.Player": "fas fa-user",
        "clubs": "fas fa-flag",
        "clubs.Club": "fas fa-shield",
        "matches": "fas fa-futbol",
        "matches.Match": "fas fa-calendar-check",
        "matches.Goal": "fas fa-futbol",
        "matches.Card": "fas fa-square",
        "matches.Round": "fas fa-layer-group",
        "stats": "fas fa-chart-line",
        "news": "fas fa-newspaper",
        "recruitment": "fas fa-briefcase",
        "recruitment.Recruiter": "fas fa-user-tie",
        "recruitment.TrialRequest": "fas fa-clipboard-check",
        "users": "fas fa-id-badge",
        "users.Profile": "fas fa-id-card",
    },

    # Colonne droite "Actions récentes" (timeline)
    "show_ui_builder": False,
    "changeform_format": "horizontal_tabs",
    "related_modal_active": True,
    "show_sidebar": True,
}

JAZZMIN_UI_TWEAKS = {
    "theme": "flatly",              # look propre
    "dark_mode_theme": None,
    "navbar": "navbar-white navbar-light",
    "sidebar": "sidebar-dark-primary",
    "brand_colour": "navbar-primary",
    "accent": "accent-primary",
    "fixed_sidebar": True,
    "sidebar_nav_small_text": False,
    "sidebar_nav_flat_style": False,
    "login_logo": None,
}
