import { vi } from 'vitest';
import { pythonServiceApi } from '@/integrations/python-service/client';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import {
  checkPythonServiceHealth,
  withFallback,
  getAccessEventsWithFallback
} from '../api-fallback';

// Mock dependencies
vi.mock('@/integrations/python-service/client', () => ({
  pythonServiceApi: {
    health: vi.fn(),
    events: {
      getAccessEvents: vi.fn()
    }
  }
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}));

vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn()
}));

// Mock console methods to reduce noise
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('API Fallback Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkPythonServiceHealth', () => {
    it('should return true when service is healthy', async () => {
      (pythonServiceApi.health as jest.Mock).mockResolvedValueOnce({
        status: 200,
        data: { status: 'ok' }
      });

      const result = await checkPythonServiceHealth();
      expect(result).toBe(true);
    });

    it('should return false when service returns non-200 status', async () => {
      (pythonServiceApi.health as jest.Mock).mockResolvedValueOnce({
        status: 500,
        data: { status: 'error' }
      });

      const result = await checkPythonServiceHealth();
      expect(result).toBe(false);
    });

    it('should return false when service throws an error', async () => {
      (pythonServiceApi.health as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const result = await checkPythonServiceHealth();
      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('withFallback', () => {
    it('should use primary function when it succeeds', async () => {
      const primaryFn = vi.fn().mockResolvedValueOnce('primary result');
      const fallbackFn = vi.fn().mockResolvedValueOnce('fallback result');

      const result = await withFallback(primaryFn, fallbackFn);

      expect(result).toBe('primary result');
      expect(primaryFn).toHaveBeenCalledTimes(1);
      expect(fallbackFn).not.toHaveBeenCalled();
    });

    it('should retry primary function before using fallback', async () => {
      const primaryFn = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockRejectedValueOnce(new Error('Third failure'));
      const fallbackFn = vi.fn().mockResolvedValueOnce('fallback result');

      const result = await withFallback(primaryFn, fallbackFn, { retryDelay: 100 });

      expect(result).toBe('fallback result');
      expect(primaryFn).toHaveBeenCalledTimes(3); // Initial + 2 retries
      expect(fallbackFn).toHaveBeenCalledTimes(1);
    });

    it('should use fallback immediately if service is known to be unhealthy', async () => {
      // First call to mark service as unhealthy
      const primaryFn1 = vi.fn().mockRejectedValueOnce(new Error('Failure'));
      const fallbackFn1 = vi.fn().mockResolvedValueOnce('fallback result 1');
      
      await withFallback(primaryFn1, fallbackFn1, { maxRetries: 0 });
      
      // Second call should use fallback immediately
      const primaryFn2 = vi.fn().mockResolvedValueOnce('primary result 2');
      const fallbackFn2 = vi.fn().mockResolvedValueOnce('fallback result 2');
      
      const result = await withFallback(primaryFn2, fallbackFn2);
      
      expect(result).toBe('fallback result 2');
      expect(primaryFn2).not.toHaveBeenCalled();
      expect(fallbackFn2).toHaveBeenCalledTimes(1);
    });

    it('should show toast when primary function fails and fallback is used', async () => {
      const primaryFn = vi.fn().mockRejectedValueOnce(new Error('Failure'));
      const fallbackFn = vi.fn().mockResolvedValueOnce('fallback result');

      await withFallback(primaryFn, fallbackFn, { maxRetries: 0 });

      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Serviço temporariamente indisponível'
      }));
    });

    it('should throw error when both primary and fallback functions fail', async () => {
      const primaryError = new Error('Primary failure');
      const fallbackError = new Error('Fallback failure');
      
      const primaryFn = vi.fn().mockRejectedValueOnce(primaryError);
      const fallbackFn = vi.fn().mockRejectedValueOnce(fallbackError);

      await expect(withFallback(primaryFn, fallbackFn, { maxRetries: 0 }))
        .rejects.toThrow(primaryError);

      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Erro no serviço',
        variant: 'destructive'
      }));
    });
  });

  describe('getAccessEventsWithFallback', () => {
    const mockParams = {
      start_date: '2024-01-01',
      end_date: '2024-02-01',
      project_id: 'test-project-id'
    };

    const mockEvents = [
      { id: '1', tipo: 'ENTRADA', data: '2024-01-15' },
      { id: '2', tipo: 'SAIDA', data: '2024-01-16' }
    ];

    it('should use Python service when available', async () => {
      (pythonServiceApi.events.getAccessEvents as jest.Mock).mockResolvedValueOnce({
        data: { events: mockEvents }
      });

      const result = await getAccessEventsWithFallback(mockParams);

      expect(result).toEqual(mockEvents);
      expect(pythonServiceApi.events.getAccessEvents).toHaveBeenCalledWith(mockParams);
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });

    it('should fall back to Supabase function when Python service fails', async () => {
      (pythonServiceApi.events.getAccessEvents as jest.Mock).mockRejectedValueOnce(
        new Error('Service unavailable')
      );

      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { data: mockEvents },
        error: null
      });

      const result = await getAccessEventsWithFallback(mockParams);

      expect(result).toEqual(mockEvents);
      expect(pythonServiceApi.events.getAccessEvents).toHaveBeenCalledWith(mockParams);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('inmeta-api', {
        method: 'POST',
        body: {
          action: 'getAccessEvents',
          startDate: mockParams.start_date,
          endDate: mockParams.end_date,
          projectId: mockParams.project_id,
        },
      });
    });

    it('should handle different Supabase response formats', async () => {
      (pythonServiceApi.events.getAccessEvents as jest.Mock).mockRejectedValueOnce(
        new Error('Service unavailable')
      );

      // Test array format
      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: mockEvents,
        error: null
      });

      const result1 = await getAccessEventsWithFallback(mockParams);
      expect(result1).toEqual(mockEvents);

      // Test eventos format
      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: { eventos: mockEvents },
        error: null
      });

      const result2 = await getAccessEventsWithFallback(mockParams);
      expect(result2).toEqual(mockEvents);
    });

    it('should handle Supabase function errors', async () => {
      (pythonServiceApi.events.getAccessEvents as jest.Mock).mockRejectedValueOnce(
        new Error('Service unavailable')
      );

      (supabase.functions.invoke as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: new Error('Supabase function error')
      });

      await expect(getAccessEventsWithFallback(mockParams)).rejects.toThrow();
    });
  });
});