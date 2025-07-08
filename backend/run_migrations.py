"""
Database migration runner
Executes SQL migrations in order
"""
import os
from sqlalchemy import text
from database import engine
from pathlib import Path

def run_migrations():
    """Run all pending SQL migrations"""
    print("🔄 Running database migrations...")
    
    migrations_dir = Path(__file__).parent / "migrations"
    if not migrations_dir.exists():
        print("📁 Creating migrations directory...")
        migrations_dir.mkdir(exist_ok=True)
        return
    
    # Get all SQL files in migrations directory
    migration_files = sorted([f for f in migrations_dir.glob("*.sql")])
    
    if not migration_files:
        print("✅ No migrations to run")
        return
    
    with engine.connect() as conn:
        # Create migrations tracking table if it doesn't exist
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS applied_migrations (
                filename VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.commit()
        
        # Get list of already applied migrations
        result = conn.execute(text("SELECT filename FROM applied_migrations"))
        applied = {row[0] for row in result}
        
        # Run each migration that hasn't been applied
        for migration_file in migration_files:
            filename = migration_file.name
            
            if filename in applied:
                print(f"⏭️  Skipping {filename} (already applied)")
                continue
                
            print(f"🔨 Running migration: {filename}")
            
            try:
                # Read and execute the migration
                with open(migration_file, 'r') as f:
                    sql = f.read()
                
                # Execute each statement separately (split by semicolon)
                statements = [s.strip() for s in sql.split(';') if s.strip()]
                for statement in statements:
                    conn.execute(text(statement))
                
                # Record that this migration has been applied
                conn.execute(
                    text("INSERT INTO applied_migrations (filename) VALUES (:filename)"),
                    {"filename": filename}
                )
                conn.commit()
                
                print(f"✅ Applied {filename}")
                
            except Exception as e:
                print(f"❌ Failed to apply {filename}: {str(e)}")
                conn.rollback()
                raise
    
    print("✅ All migrations completed successfully")

if __name__ == "__main__":
    run_migrations()