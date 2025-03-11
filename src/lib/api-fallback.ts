/**
 * API Fallback Utility
 * 
 * This utility provides fallback mechanisms for API calls to ensure
 * the application continues to function even when the primary API fails.
 */

import { toast } from '@/components/ui/use-toast';
import { pythonServiceApi } from '@/integrations/python-service/client';
import { supabase } from '@/integrations/supabase/client';

/**
 * Configuration for fallback behavior
 */
interface FallbackConfig {
  // Maximum number of retries before switching to fallback
  maxRetries?: number;
  // Delay between retries in milliseconds
  retryDelay?: number;
  // Whether to show error toasts to the user
  showErrorToasts?: boolean;
  // Whether to automatically switch to fallback on failure
  autoSwitchToFallback?: boolean;
}

// Default configuration
const defaultConfig: FallbackConfig = {
  maxRetries: 2,
  retryDelay: 1000,
  showErrorToasts: true,
  autoSwitchToFallback: true,
};

// Track service health status
const serviceStatus = {
  pythonService: {
    healthy: true,
    lastChecked: 0,
  },
};

/**
 * Check the health of the Python microservice
 * @returns Promise<boolean> - True if the service is healthy
 */
export const checkPythonServiceHealth = async (): Promise<boolean> => {
  try {
    const response = await pythonServiceApi.health();
    const isHealthy = response.status === 200 && response.data.status === 'ok';
    
    serviceStatus.pythonService.healthy = isHealthy;
    serviceStatus.pythonService.lastChecked = Date.now();
    
    return isHealthy;
  } catch (error) {
    console.error('Python service health check failed:', error);
    serviceStatus.pythonService.healthy = false;
    serviceStatus.pythonService.lastChecked = Date.now();
    return false;
  }
};

/**
 * Execute a function with retry and fallback logic
 * @param primaryFn - The primary function to execute (Python microservice)
 * @param fallbackFn - The fallback function to execute if primary fails (Supabase function)
 * @param config - Configuration for fallback behavior
 * @returns Promise with the result of either the primary or fallback function
 */
export const withFallback = async <T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  config: FallbackConfig = {}
): Promise<T> => {
  const { maxRetries, retryDelay, showErrorToasts, autoSwitchToFallback } = {
    ...defaultConfig,
    ...config,
  };

  // If the service is known to be unhealthy and was checked recently, use fallback immediately
  const HEALTH_CHECK_THRESHOLD = 30000; // 30 seconds
  if (
    !serviceStatus.pythonService.healthy &&
    Date.now() - serviceStatus.pythonService.lastChecked < HEALTH_CHECK_THRESHOLD
  ) {
    console.log('Using fallback immediately due to known service issues');
    return fallbackFn();
  }

  // Try the primary function with retries
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries!; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt} of ${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
      return await primaryFn();
    } catch (error) {
      console.error(`Primary function failed (attempt ${attempt + 1}):`, error);
      lastError = error;
    }
  }

  // If we get here, all primary attempts failed
  if (showErrorToasts) {
    toast({
      title: 'Serviço temporariamente indisponível',
      description: 'Usando serviço alternativo para continuar a operação.',
      variant: 'default',
    });
  }

  // Update service health status
  serviceStatus.pythonService.healthy = false;
  serviceStatus.pythonService.lastChecked = Date.now();

  // Try the fallback function
  try {
    console.log('Using fallback function');
    return await fallbackFn();
  } catch (fallbackError) {
    console.error('Fallback function also failed:', fallbackError);
    
    if (showErrorToasts) {
      toast({
        title: 'Erro no serviço',
        description: 'Não foi possível completar a operação. Por favor, tente novamente mais tarde.',
        variant: 'destructive',
      });
    }
    
    // Re-throw the original error from the primary function
    throw lastError;
  }
};

/**
 * Get access events with fallback mechanism
 */
export const getAccessEventsWithFallback = async (params: {
  start_date: string;
  end_date: string;
  project_id: string;
}) => {
  return withFallback(
    // Primary function - Python microservice
    async () => {
      const response = await pythonServiceApi.events.getAccessEvents(params);
      return response.data.events || [];
    },
    // Fallback function - Supabase function
    async () => {
      const { data, error } = await supabase.functions.invoke('inmeta-api', {
        method: 'POST',
        body: {
          action: 'getAccessEvents',
          startDate: params.start_date,
          endDate: params.end_date,
          projectId: params.project_id,
        },
      });

      if (error) throw error;
      
      // Handle different response formats
      if (data?.data && Array.isArray(data.data)) {
        return data.data;
      } else if (Array.isArray(data)) {
        return data;
      } else if (data?.eventos && Array.isArray(data.eventos)) {
        return data.eventos;
      }
      
      return [];
    }
  );
};