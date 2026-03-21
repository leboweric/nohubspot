"""
Background scheduler for periodic tasks
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import logging
from scripts.standardize_phone_numbers import standardize_phone_numbers
import os

logger = logging.getLogger(__name__)

# Initialize scheduler
scheduler = BackgroundScheduler()

def init_scheduler():
    """Initialize and start the background scheduler with all scheduled jobs."""
    
    # Only start scheduler if not in test/development mode
    if os.getenv("DISABLE_SCHEDULER", "false").lower() == "true":
        logger.info("Scheduler disabled via DISABLE_SCHEDULER environment variable")
        return
    
    # Schedule phone number standardization to run every night at 2 AM
    scheduler.add_job(
        func=run_phone_standardization,
        trigger=CronTrigger(hour=2, minute=0),  # 2:00 AM every day
        id='standardize_phone_numbers',
        name='Standardize phone numbers',
        replace_existing=True
    )
    
    # Schedule email processor to check for due scheduled emails every 60 seconds
    scheduler.add_job(
        func=process_scheduled_emails,
        trigger=IntervalTrigger(seconds=60),
        id='process_scheduled_emails',
        name='Process scheduled emails',
        replace_existing=True
    )
    
    # Start the scheduler
    scheduler.start()
    logger.info("Background scheduler started successfully")
    
    # Log all scheduled jobs
    jobs = scheduler.get_jobs()
    for job in jobs:
        logger.info(f"Scheduled job: {job.name} - Next run: {job.next_run_time}")


def run_phone_standardization(organization_id=None):
    """Wrapper function to run phone standardization with error handling."""
    try:
        logger.info("Starting scheduled phone number standardization...")
        stats = standardize_phone_numbers(organization_id=organization_id)
        logger.info(f"Phone standardization completed: {stats}")
        return stats
    except Exception as e:
        logger.error(f"Error in scheduled phone standardization: {str(e)}", exc_info=True)
        raise


def process_scheduled_emails():
    """Check for and send any pending scheduled emails that are due."""
    import asyncio
    from database import SessionLocal
    from models import ScheduledEmail
    from datetime import datetime
    
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        pending = db.query(ScheduledEmail).filter(
            ScheduledEmail.status == "pending",
            ScheduledEmail.scheduled_at <= now
        ).all()
        
        if not pending:
            return
        
        logger.info(f"Found {len(pending)} scheduled email(s) due for sending")
        
        # Create a new event loop for this background thread
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            for scheduled in pending:
                try:
                    scheduled.status = "sending"
                    db.commit()
                    
                    # Import here to avoid circular imports
                    from bulk_email_service import send_bulk_email
                    
                    result = loop.run_until_complete(
                        send_bulk_email(
                            db=db,
                            organization_id=scheduled.organization_id,
                            sender_user_id=scheduled.created_by,
                            contact_ids=scheduled.contact_ids,
                            subject=scheduled.subject,
                            html_content=scheduled.html_content,
                            from_email=scheduled.from_email,
                            from_name=scheduled.from_name,
                            text_content=scheduled.text_content,
                            bcc_email=scheduled.bcc_email,
                        )
                    )
                    
                    scheduled.status = "sent"
                    scheduled.sent_at = datetime.utcnow()
                    scheduled.result = result
                    db.commit()
                    
                    logger.info(f"Scheduled email {scheduled.id} sent successfully: {result.get('message', 'OK')}")
                    
                except Exception as e:
                    scheduled.status = "failed"
                    scheduled.result = {"error": str(e)}
                    db.commit()
                    logger.error(f"Scheduled email {scheduled.id} failed: {e}", exc_info=True)
        finally:
            loop.close()
    except Exception as e:
        logger.error(f"Error in process_scheduled_emails: {e}", exc_info=True)
    finally:
        db.close()


def shutdown_scheduler():
    """Shutdown the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background scheduler shut down")


# Manual trigger functions for testing
def trigger_phone_standardization(organization_id=None):
    """Manually trigger phone standardization job."""
    logger.info("Manually triggering phone standardization...")
    return run_phone_standardization(organization_id=organization_id)
