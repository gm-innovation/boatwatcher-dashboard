from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    'inmeta-service',
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max
    worker_max_tasks_per_child=1000,
    worker_prefetch_multiplier=1,
    task_routes={
        'app.tasks.*': {'queue': 'default'}
    }
)

# Configure periodic tasks
celery_app.conf.beat_schedule = {
    'sync-inmeta-data': {
        'task': 'app.tasks.sync.sync_inmeta_data',
        'schedule': crontab(minute='*/30'),  # Run every 30 minutes
    },
    'cleanup-old-cache': {
        'task': 'app.tasks.maintenance.cleanup_old_cache',
        'schedule': crontab(hour=0, minute=0),  # Run daily at midnight
    }
}

# Configure retry settings
celery_app.conf.task_acks_late = True
celery_app.conf.task_reject_on_worker_lost = True

# Configure monitoring
celery_app.conf.worker_send_task_events = True
celery_app.conf.task_send_sent_event = True