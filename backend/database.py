from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Railway PostgreSQL connection - configured for your database
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    print("❌ DATABASE_URL environment variable not found!")
    # Fallback for local development - use SQLite
    DATABASE_URL = "sqlite:///./nohubspot.db"

print(f"🔗 Connecting to database: {DATABASE_URL[:50]}...")

# Fix for Railway's postgres:// URL format
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

try:
    # ✅ CRITICAL: Add connection pool configuration
    engine = create_engine(
        DATABASE_URL, 
        echo=False,
        # Connection pool settings
        pool_size=20,          # Increase from default 5 to 20
        max_overflow=30,       # Allow 30 additional connections
        pool_timeout=30,       # Wait 30s for connection
        pool_recycle=3600,     # Recycle connections every hour
        pool_pre_ping=True,    # Verify connections before use
        # Additional performance settings
        connect_args={
            "connect_timeout": 10,
            "application_name": "nohubspot_crm"
        } if DATABASE_URL.startswith("postgresql://") else {}
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    print("✅ Database engine created with connection pool")
except Exception as e:
    print(f"❌ Failed to create database engine: {e}")
    raise

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
