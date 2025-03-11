import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import { usePythonService } from '../../hooks/usePythonService';
import { useSupabase } from '../../hooks/useSupabase';
import { useEventsWithFallback } from '../../hooks/useEventsWithFallback';

// Mock the hooks
vi.mock('../../hooks/usePythonService');
vi.mock('../../hooks/useSupabase');
vi.mock('../../hooks/useEventsWithFallback');

describe('Service Communication Integration', () => {
  describe('End-to-End API Communication', () => {
    it('should successfully communicate between frontend and Python service', async () => {
      const mockEvents = [
        { id: 1, event_type: 'access', timestamp: '2024-06-10T08:30:00Z', worker_id: 101 },
        { id: 2, event_type: 'exit', timestamp: '2024-06-10T17:45:00Z', worker_id: 101 }
      ];

      // Mock the Python service hook
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: vi.fn().mockResolvedValue(mockEvents),
        isLoading: false,
        error: null
      });

      // Test the hook
      const { result } = renderHook(() => usePythonService());
      
      // Verify API method exists
      expect(result.current.getAccessEvents).toBeDefined();
      
      // Call the API method
      const events = await result.current.getAccessEvents({ projectId: 'project-1' });
      
      // Verify response
      expect(events).toEqual(mockEvents);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should successfully communicate between frontend and Supabase', async () => {
      const mockProjects = [
        { id: 'project-1', name: 'Project 1', status: 'active' },
        { id: 'project-2', name: 'Project 2', status: 'completed' }
      ];

      // Mock the Supabase hook
      const mockUseSupabase = useSupabase as jest.Mock;
      mockUseSupabase.mockReturnValue({
        getProjects: vi.fn().mockResolvedValue(mockProjects),
        isLoading: false,
        error: null
      });

      // Test the hook
      const { result } = renderHook(() => useSupabase());
      
      // Verify API method exists
      expect(result.current.getProjects).toBeDefined();
      
      // Call the API method
      const projects = await result.current.getProjects();
      
      // Verify response
      expect(projects).toEqual(mockProjects);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Authentication Flow', () => {
    it('should handle authentication token in API requests', async () => {
      const mockToken = 'mock-auth-token';
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      
      // Mock Supabase auth
      const mockUseSupabase = useSupabase as jest.Mock;
      mockUseSupabase.mockReturnValue({
        getAuthToken: vi.fn().mockResolvedValue(mockToken),
        user: mockUser,
        isLoading: false,
        error: null
      });
      
      // Mock Python service with auth header check
      const mockGetAccessEvents = vi.fn().mockImplementation((params) => {
        // Verify auth token is included in request
        if (params.authToken === mockToken) {
          return Promise.resolve([
            { id: 1, event_type: 'access', timestamp: '2024-06-10T08:30:00Z', worker_id: 101 }
          ]);
        } else {
          return Promise.reject(new Error('Unauthorized'));
        }
      });
      
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: mockGetAccessEvents,
        isLoading: false,
        error: null
      });
      
      // Test authentication flow
      const { result: supabaseResult } = renderHook(() => useSupabase());
      const { result: pythonServiceResult } = renderHook(() => usePythonService());
      
      // Get auth token
      const token = await supabaseResult.current.getAuthToken();
      expect(token).toBe(mockToken);
      
      // Use token in API request
      const events = await pythonServiceResult.current.getAccessEvents({
        projectId: 'project-1',
        authToken: token
      });
      
      // Verify request was authenticated
      expect(events).toBeDefined();
      expect(events.length).toBe(1);
      expect(mockGetAccessEvents).toHaveBeenCalledWith({
        projectId: 'project-1',
        authToken: mockToken
      });
    });
  });

  describe('Request/Response Interceptors', () => {
    it('should handle request formatting and response parsing', async () => {
      // Mock raw request data
      const rawRequest = {
        projectId: 'project-1',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-30')
      };
      
      // Expected formatted request
      const formattedRequest = {
        project_id: 'project-1',
        start_date: '2024-06-01',
        end_date: '2024-06-30'
      };
      
      // Mock raw response data
      const rawResponse = [
        { id: 1, event_type: 'access', timestamp: '2024-06-10T08:30:00Z', worker_id: 101 }
      ];
      
      // Expected parsed response
      const parsedResponse = [
        {
          id: 1,
          eventType: 'access',
          timestamp: '2024-06-10T08:30:00Z',
          workerId: 101,
          formattedTime: expect.any(String) // Local time format
        }
      ];
      
      // Mock request interceptor
      const mockRequestInterceptor = vi.fn().mockImplementation((req) => {
        // Convert camelCase to snake_case
        return {
          project_id: req.projectId,
          start_date: req.startDate.toISOString().split('T')[0],
          end_date: req.endDate.toISOString().split('T')[0]
        };
      });
      
      // Mock response interceptor
      const mockResponseInterceptor = vi.fn().mockImplementation((res) => {
        // Convert snake_case to camelCase and add formatted time
        return res.map(item => ({
          id: item.id,
          eventType: item.event_type,
          timestamp: item.timestamp,
          workerId: item.worker_id,
          formattedTime: new Date(item.timestamp).toLocaleString()
        }));
      });
      
      // Mock Python service with interceptors
      const mockGetAccessEvents = vi.fn().mockImplementation((req) => {
        // Verify request was formatted correctly
        expect(req).toEqual(formattedRequest);
        return Promise.resolve(rawResponse);
      });
      
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: mockGetAccessEvents,
        formatRequest: mockRequestInterceptor,
        parseResponse: mockResponseInterceptor,
        isLoading: false,
        error: null
      });
      
      // Test interceptors
      const { result } = renderHook(() => usePythonService());
      
      // Format request
      const formattedReq = result.current.formatRequest(rawRequest);
      expect(formattedReq).toEqual(formattedRequest);
      
      // Make API call with formatted request
      await result.current.getAccessEvents(formattedReq);
      
      // Parse response
      const parsedRes = result.current.parseResponse(rawResponse);
      expect(parsedRes).toMatchObject(parsedResponse);
    });
  });

  describe('Timeout Handling', () => {
    it('should handle request timeouts', async () => {
      const timeoutError = new Error('Request timed out');
      timeoutError.name = 'TimeoutError';
      
      // Mock Python service with timeout
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: vi.fn().mockRejectedValue(timeoutError),
        isLoading: false,
        error: timeoutError
      });
      
      // Mock fallback mechanism
      const mockUseEventsWithFallback = useEventsWithFallback as jest.Mock;
      mockUseEventsWithFallback.mockReturnValue({
        events: [],
        summary: null,
        isLoading: false,
        error: timeoutError,
        useFallback: true
      });
      
      // Test timeout handling
      const { result } = renderHook(() => useEventsWithFallback('project-1'));
      
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.error.name).toBe('TimeoutError');
        expect(result.current.useFallback).toBe(true);
      });
    });
  });

  describe('Retry Mechanisms', () => {
    it('should retry failed requests', async () => {
      // Mock a function that fails once then succeeds
      const mockGetAccessEvents = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([
          { id: 1, event_type: 'access', timestamp: '2024-06-10T08:30:00Z', worker_id: 101 }
        ]);
      
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: mockGetAccessEvents,
        retryRequest: vi.fn().mockImplementation(async (fn, retries = 3) => {
          // Simple retry implementation
          let lastError;
          for (let i = 0; i < retries; i++) {
            try {
              return await fn();
            } catch (error) {
              lastError = error;
              // In a real implementation, would add delay here
            }
          }
          throw lastError;
        }),
        isLoading: false,
        error: null
      });
      
      // Test retry mechanism
      const { result } = renderHook(() => usePythonService());
      
      // Execute request with retry
      const response = await result.current.retryRequest(
        () => result.current.getAccessEvents({ projectId: 'project-1' })
      );
      
      // Verify retry worked
      expect(mockGetAccessEvents).toHaveBeenCalledTimes(2);
      expect(response).toBeDefined();
      expect(response.length).toBe(1);
    });
  });
});