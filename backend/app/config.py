import os
from datetime import timedelta

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "rmc-super-secret-dev-key-change-in-prod")
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "rmc-jwt-dev-secret-key-change-in-prod")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    
    # Database config:
    # 1. DATABASE_URL if provided (PostgreSQL on Fly.io / Supabase / Neon)
    # 2. /data/rmc.db if persistent Fly volume is mounted at /data
    # 3. Default local backend/rmc.db
    _local_db = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "rmc.db"))
    _volume_db = "/data/rmc.db"
    _default_db = f"sqlite:///{_volume_db if os.path.isdir('/data') else _local_db}"
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", _default_db)
    # Fix for postgres:// to postgresql:// if needed
    if SQLALCHEMY_DATABASE_URI.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URI = SQLALCHEMY_DATABASE_URI.replace("postgres://", "postgresql://", 1)
        
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
    } if "postgresql" in SQLALCHEMY_DATABASE_URI else {}

    SWAGGER = {
        "title": "RMC Order-to-Delivery API",
        "uiversion": 3,
        "openapi": "3.0.2",
        "version": "1.0.0",
        "description": "API for Ready-Mix Concrete plant order-to-delivery workflow"
    }

class DevelopmentConfig(Config):
    DEBUG = True

class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)

class ProductionConfig(Config):
    DEBUG = False
