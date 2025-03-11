# Import tasks to make them available for Celery
from app.tasks.sync import sync_inmeta_data, cleanup_old_cache
from app.tasks.maintenance import monitor_system_resources

# Export tasks for easier imports
__all__ = ['sync_inmeta_data', 'cleanup_old_cache', 'monitor_system_resources']