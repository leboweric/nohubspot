from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError
import os
import logging

# Railway PostgreSQL connection - configured for your database
DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    logging.critical("STARTUP_FAILURE: DATABASE_URL environment variable not found!")
    # Fallback for local development - use SQLite
    DATABASE_URL = "sqlite:///./nohubspot.db"
    logging.warning("STARTUP: Falling back to SQLite for local development")
else:
    logging.info("STARTUP: DATABASE_URL environment variable found")
    # Log the database host but not credentials for security
    try:
        db_host = DATABASE_URL.split('@')[-1].split('/')[0]
        logging.info(f"STARTUP: Database host configuration: {db_host}")
    except Exception:
        logging.warning("STARTUP: Could not parse database host from DATABASE_URL for logging")

logging.info(f"STARTUP: Attempting to create database engine...")

# Fix for Railway's postgres:// URL format
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    logging.info("STARTUP: Fixed postgres:// URL format to postgresql://")

try:
    # ✅ CRITICAL: Add connection pool configuration
    logging.info("STARTUP: Creating SQLAlchemy engine with connection pool...")
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
    logging.info("STARTUP: Database engine created successfully with connection pool")
    
    # Test the connection immediately
    logging.info("STARTUP: Testing database connection with SELECT 1...")
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
        logging.info("STARTUP: Database connection test SUCCESSFUL")
        
except OperationalError as e:
    logging.critical(f"STARTUP_FAILURE: Database connection failed (OperationalError): {e}")
    raise
except Exception as e:
    logging.critical(f"STARTUP_FAILURE: Failed to create database engine (Unexpected error): {e}")
    raise

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
