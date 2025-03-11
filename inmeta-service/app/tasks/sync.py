from celery import shared_task
from app.services.inmeta import InmetaService
from app.services.supabase import SupabaseService
from app.core.config import settings
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def sync_inmeta_data(self):
    """Synchronize data from Inmeta API to local cache"""
    try:
        inmeta_service = InmetaService()
        supabase_service = SupabaseService()

        # Fetch and process events
        events = inmeta_service.fetch_events()
        processed_events = inmeta_service.process_events(events)

        # Update Supabase with processed data
        supabase_service.update_events(processed_events)

        logger.info(f'Successfully synchronized {len(processed_events)} events')
        return True

    except Exception as exc:
        logger.error(f'Error synchronizing Inmeta data: {exc}')
        self.retry(exc=exc, countdown=60 * 5)  # Retry in 5 minutes

@shared_task
def cleanup_old_cache():
    """Clean up old cache entries to prevent memory issues"""
    try:
        # Calculate cutoff date (e.g., 7 days ago)
        cutoff_date = datetime.utcnow() - timedelta(days=7)

        # Clean up Redis cache
        from app.core.celery import celery_app
        redis = celery_app.backend.client
        
        # Get all keys and filter old ones
        pattern = f'{settings.REDIS_PREFIX}:*'
        keys = redis.keys(pattern)
        
        cleaned = 0
        for key in keys:
            try:
                # Check timestamp in key or metadata
                timestamp = redis.hget(key, 'timestamp')
                if timestamp and datetime.fromtimestamp(float(timestamp)) < cutoff_date:
                    redis.delete(key)
                    cleaned += 1
            except Exception as e:
                logger.warning(f'Error cleaning key {key}: {e}')

        logger.info(f'Successfully cleaned {cleaned} old cache entries')
        return cleaned

    except Exception as exc:
        logger.error(f'Error cleaning cache: {exc}')
        raise  # No retry for cleanup tasks