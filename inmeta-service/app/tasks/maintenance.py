from celery import shared_task
from app.core.config import settings
from datetime import datetime, timedelta
import logging
import os
import psutil

logger = logging.getLogger(__name__)

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

@shared_task
def monitor_system_resources():
    """Monitor system resources and log warnings if thresholds are exceeded"""
    try:
        # Get system metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Log system metrics
        logger.info(f'System metrics - CPU: {cpu_percent}%, Memory: {memory.percent}%, Disk: {disk.percent}%')
        
        # Check thresholds and log warnings
        if cpu_percent > 80:
            logger.warning(f'High CPU usage: {cpu_percent}%')
        
        if memory.percent > 80:
            logger.warning(f'High memory usage: {memory.percent}%')
            
        if disk.percent > 80:
            logger.warning(f'High disk usage: {disk.percent}%')
            
        return {
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'disk_percent': disk.percent
        }
        
    except Exception as exc:
        logger.error(f'Error monitoring system resources: {exc}')
        raise