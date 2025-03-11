# Python Microservice Integration

This directory contains the integration code for the Python microservice that handles Inmeta API integration and Supabase data processing.

## Overview

The Python microservice provides improved performance, caching, and more robust data processing compared to the direct Supabase function approach. This integration layer allows the frontend to seamlessly communicate with the microservice while providing fallback mechanisms in case of service unavailability.

## Setup

1. Ensure the Python microservice is running (see `inmeta-service` directory for setup instructions)
2. Add the following environment variable to your `.env` file:

```
VITE_PYTHON_SERVICE_URL=http://localhost:8000
```

## Usage

### Direct API Access

You can use the `pythonServiceApi` client directly:

```typescript
import { pythonServiceApi } from '@/integrations/python-service/client';

// Health check
const checkHealth = async () => {
  const response = await pythonServiceApi.health();
  return response.data.status === 'ok';
};

// Get access events
const getEvents = async (projectId: string) => {
  const startDate = '2024-02-01';
  const endDate = new Date().toISOString().split('T')[0];
  
  const response = await pythonServiceApi.events.getAccessEvents({
    start_date: startDate,
    end_date: endDate,
    project_id: projectId
  });
  
  return response.data.events;
};
```

### React Hooks

For React components, use the provided hooks:

```typescript
import { useAccessEvents, useProjects, useProject } from '@/hooks/usePythonService';

// In your component:
const MyComponent = ({ projectId }) => {
  const { data: events, isLoading, error } = useAccessEvents(projectId);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading events</div>;
  
  return (
    <div>
      <h2>Events</h2>
      <ul>
        {events.map(event => (
          <li key={event.data}>{event.nomePessoa} - {event.tipo}</li>
        ))}
      </ul>
    </div>
  );
};
```

### With Fallback Support

For critical features that need high availability, use the fallback hooks:

```typescript
import { useEventsWithFallback } from '@/hooks/useEventsWithFallback';

// In your component:
const MyComponent = ({ projectId }) => {
  const { data: events, isLoading, error } = useEventsWithFallback(projectId);
  
  // Rest of component...
};
```

## Error Handling

The integration includes comprehensive error handling:

1. Automatic retries for transient failures
2. Fallback to Supabase functions when the microservice is unavailable
3. User-friendly error messages via toast notifications
4. Detailed logging for debugging

## Health Monitoring

The system automatically monitors the health of the Python microservice and switches to fallback mechanisms when needed. You can also manually check the service health:

```typescript
import { checkPythonServiceHealth } from '@/lib/api-fallback';

const isHealthy = await checkPythonServiceHealth();
console.log('Python service health:', isHealthy ? 'Healthy' : 'Unhealthy');
```