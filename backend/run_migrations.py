"""
Database migration runner
Executes SQL migrations in order
"""
import os
import logging
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError
from database import engine
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

def run_migrations():
    """Run all pending SQL migrations"""
    logging.info("MIGRATION: Starting database migration process...")
    
    migrations_dir = Path(__file__).parent / "migrations"
    if not migrations_dir.exists():
        logging.info("MIGRATION: Creating migrations directory...")
        migrations_dir.mkdir(exist_ok=True)
        return
    
    # Get all SQL files in migrations directory
    migration_files = sorted([f for f in migrations_dir.glob("*.sql")])
    
    if not migration_files:
        logging.info("MIGRATION: No migrations to run")
        return
    
    logging.info(f"MIGRATION: Found {len(migration_files)} migration files")
    
    try:
        with engine.connect() as conn:
            # Create migrations tracking table if it doesn't exist
            logging.info("MIGRATION: Creating/checking applied_migrations table...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS applied_migrations (
                    filename VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
            
            # Get list of already applied migrations
            logging.info("MIGRATION: Checking for already applied migrations...")
            result = conn.execute(text("SELECT filename FROM applied_migrations"))
            applied = {row[0] for row in result}
            logging.info(f"MIGRATION: Found {len(applied)} already applied migrations")
            
            # Run each migration that hasn't been applied
            for migration_file in migration_files:
                filename = migration_file.name
                
                if filename in applied:
                    logging.info(f"MIGRATION: Skipping {filename} (already applied)")
                    continue
                    
                logging.info(f"MIGRATION: Starting migration: {filename}")
                
                try:
                    # Read the migration file
                    logging.info(f"MIGRATION: Reading file {filename}...")
                    with open(migration_file, 'r') as f:
                        sql = f.read()
                    
                    logging.info(f"MIGRATION: File {filename} read successfully, size: {len(sql)} chars")
                    
                    # Execute each statement separately (split by semicolon)
                    statements = [s.strip() for s in sql.split(';') if s.strip()]
                    logging.info(f"MIGRATION: Found {len(statements)} SQL statements in {filename}")
                    
                    for i, statement in enumerate(statements, 1):
                        logging.info(f"MIGRATION: Executing statement {i}/{len(statements)} from {filename}")
                        logging.debug(f"MIGRATION: Statement preview: {statement[:100]}...")
                        
                        try:
                            conn.execute(text(statement))
                            logging.info(f"MIGRATION: Statement {i} executed successfully")
                        except Exception as stmt_error:
                            logging.error(f"MIGRATION: Statement {i} failed: {stmt_error}")
                            logging.error(f"MIGRATION: Failed statement: {statement}")
                            raise
                    
                    # Record that this migration has been applied
                    logging.info(f"MIGRATION: Recording {filename} as applied...")
                    conn.execute(
                        text("INSERT INTO applied_migrations (filename) VALUES (:filename)"),
                        {"filename": filename}
                    )
                    conn.commit()
                    
                    logging.info(f"MIGRATION: ✅ Successfully applied {filename}")
                    
                except OperationalError as e:
                    logging.critical(f"MIGRATION_FAILURE: Database operational error in {filename}: {e}")
                    conn.rollback()
                    raise
                except ProgrammingError as e:
                    logging.critical(f"MIGRATION_FAILURE: SQL programming error in {filename}: {e}")
                    conn.rollback()
                    raise
                except Exception as e:
                    logging.critical(f"MIGRATION_FAILURE: Unexpected error in {filename}: {type(e).__name__}: {e}")
                    conn.rollback()
                    raise
        
        logging.info("MIGRATION: ✅ All migrations completed successfully")
        
    except Exception as e:
        logging.critical(f"MIGRATION_FAILURE: Migration process failed: {e}")
        raise

if __name__ == "__main__":
    run_migrations()