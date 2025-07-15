"""
Background scheduler for periodic tasks
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
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
    
    # Start the scheduler
    scheduler.start()
    logger.info("Background scheduler started successfully")
    
    # Log all scheduled jobs
    jobs = scheduler.get_jobs()
    for job in jobs:
        logger.info(f"Scheduled job: {job.name} - Next run: {job.next_run_time}")


def run_phone_standardization():
    """Wrapper function to run phone standardization with error handling."""
    try:
        logger.info("Starting scheduled phone number standardization...")
        stats = standardize_phone_numbers()
        logger.info(f"Phone standardization completed: {stats}")
    except Exception as e:
        logger.error(f"Error in scheduled phone standardization: {str(e)}", exc_info=True)


def shutdown_scheduler():
    """Shutdown the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background scheduler shut down")


# Manual trigger functions for testing
def trigger_phone_standardization():
    """Manually trigger phone standardization job."""
    logger.info("Manually triggering phone standardization...")
    run_phone_standardization()