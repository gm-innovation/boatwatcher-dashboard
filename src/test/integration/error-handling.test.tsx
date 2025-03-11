import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import { useEventsWithFallback } from '../../hooks/useEventsWithFallback';
import { usePythonService } from '../../hooks/usePythonService';
import { useSupabase } from '../../hooks/useSupabase';
import { SummaryCards } from '../../components/SummaryCards';

// Mock the hooks
vi.mock('../../hooks/usePythonService');
vi.mock('../../hooks/useSupabase');
vi.mock('../../hooks/useEventsWithFallback');

describe('Error Handling Integration', () => {
  describe('Network Errors', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';
      
      // Mock the Python service hook with network error
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: vi.fn().mockRejectedValue(networkError),
        isLoading: false,
        error: networkError
      });
      
      // Mock the fallback hook
      const mockUseEventsWithFallback = useEventsWithFallback as jest.Mock;
      mockUseEventsWithFallback.mockReturnValue({
        events: [],
        summary: null,
        isLoading: false,
        error: networkError,
        useFallback: true
      });
      
      // Render component that should handle the error
      render(<SummaryCards projectId="project-1" />);
      
      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
        expect(screen.getByText(/using fallback data source/i)).toBeInTheDocument();
      });
    });
  });
  
  describe('Invalid Response Format', () => {
    it('should handle invalid response format', async () => {
      const invalidResponseError = new Error('Invalid response format');
      
      // Mock invalid response from API
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: vi.fn().mockResolvedValue(null), // Invalid response
        isLoading: false,
        error: invalidResponseError
      });
      
      // Test the hook that should handle the error
      const { result } = renderHook(() => useEventsWithFallback('project-1'));
      
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.useFallback).toBe(true);
      });
    });
  });
  
  describe('Rate Limiting', () => {
    it('should handle rate limiting errors', async () => {
      const rateLimitError = new Error('Too many requests');
      rateLimitError.name = 'RateLimitError';
      
      // Mock rate limit error from API
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: vi.fn().mockRejectedValue(rateLimitError),
        isLoading: false,
        error: rateLimitError
      });
      
      // Test the hook that should handle the error
      const { result } = renderHook(() => useEventsWithFallback('project-1'));
      
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error.name).toBe('RateLimitError');
        expect(result.current.useFallback).toBe(true);
      });
    });
  });
  
  describe('Service Unavailability', () => {
    it('should handle service unavailability', async () => {
      const serviceError = new Error('Service unavailable');
      
      // Mock service unavailable error
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: vi.fn().mockRejectedValue(serviceError),
        isLoading: false,
        error: serviceError
      });
      
      // Mock Supabase fallback
      const mockUseSupabase = useSupabase as jest.Mock;
      mockUseSupabase.mockReturnValue({
        getEvents: vi.fn().mockResolvedValue([
          { id: 1, event_type: 'access', timestamp: '2024-06-10T08:30:00Z', worker_id: 101 }
        ]),
        isLoading: false,
        error: null
      });
      
      // Test the fallback mechanism
      const { result } = renderHook(() => useEventsWithFallback('project-1'));
      
      await waitFor(() => {
        expect(result.current.useFallback).toBe(true);
        expect(result.current.events.length).toBe(1);
      });
    });
  });
  
  describe('Recovery Mechanisms', () => {
    it('should recover after service restoration', async () => {
      const mockUsePythonService = usePythonService as jest.Mock;
      
      // First call fails
      mockUsePythonService.mockReturnValueOnce({
        getAccessEvents: vi.fn().mockRejectedValue(new Error('Service unavailable')),
        isLoading: false,
        error: new Error('Service unavailable')
      });
      
      // Second call succeeds after "service restoration"
      mockUsePythonService.mockReturnValueOnce({
        getAccessEvents: vi.fn().mockResolvedValue([
          { id: 1, event_type: 'access', timestamp: '2024-06-10T08:30:00Z', worker_id: 101 }
        ]),
        isLoading: false,
        error: null
      });
      
      // Test the recovery mechanism
      const { result, rerender } = renderHook(() => useEventsWithFallback('project-1'));
      
      // First render should use fallback
      await waitFor(() => {
        expect(result.current.useFallback).toBe(true);
      });
      
      // Simulate service restoration and re-render
      rerender();
      
      // Second render should use primary service
      await waitFor(() => {
        expect(result.current.useFallback).toBe(false);
        expect(result.current.events.length).toBe(1);
      });
    });
  });
});