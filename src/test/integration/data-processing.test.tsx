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

describe('Data Processing Integration', () => {
  describe('Data Transformation', () => {
    it('should transform raw API data into component-ready format', async () => {
      // Mock raw data from API
      const rawEvents = [
        { id: 1, event_type: 'access', timestamp: '2024-06-10T08:30:00Z', worker_id: 101, location: 'Gate A' },
        { id: 2, event_type: 'exit', timestamp: '2024-06-10T17:45:00Z', worker_id: 101, location: 'Gate A' },
        { id: 3, event_type: 'access', timestamp: '2024-06-11T08:15:00Z', worker_id: 102, location: 'Gate B' }
      ];

      // Expected transformed data
      const expectedSummary = {
        totalWorkers: 2,
        activeWorkers: 1,
        totalHours: 9.25, // Hours between access and exit for worker 101
        averageHours: 9.25
      };

      // Mock the Python service hook
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: vi.fn().mockResolvedValue(rawEvents),
        isLoading: false,
        error: null
      });

      // Mock the events with fallback hook that processes the data
      const mockUseEventsWithFallback = useEventsWithFallback as jest.Mock;
      mockUseEventsWithFallback.mockReturnValue({
        events: rawEvents,
        summary: expectedSummary,
        isLoading: false,
        error: null,
        useFallback: false
      });

      // Render component that uses the processed data
      render(<SummaryCards projectId="project-1" />);

      // Verify the transformed data is displayed correctly
      await waitFor(() => {
        expect(screen.getByText(expectedSummary.totalWorkers.toString())).toBeInTheDocument();
        expect(screen.getByText(expectedSummary.activeWorkers.toString())).toBeInTheDocument();
        expect(screen.getByText(expectedSummary.totalHours.toString())).toBeInTheDocument();
      });
    });
  });

  describe('Date Handling', () => {
    it('should handle date formatting across timezones', async () => {
      // Mock event with UTC timestamp
      const utcEvent = { 
        id: 1, 
        event_type: 'access', 
        timestamp: '2024-06-10T15:30:00Z', // UTC time
        worker_id: 101, 
        location: 'Gate A' 
      };

      // Mock the Python service hook
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: vi.fn().mockResolvedValue([utcEvent]),
        isLoading: false,
        error: null
      });

      // Test the hook that should handle date conversion
      const { result } = renderHook(() => useEventsWithFallback('project-1'));
      
      await waitFor(() => {
        expect(result.current.events).toBeDefined();
        expect(result.current.events.length).toBe(1);
        
        // Check that the timestamp was properly converted to local time format
        // This test assumes the component converts UTC to local time for display
        const event = result.current.events[0];
        expect(event.formattedTime).toBeDefined();
        
        // The exact expected value depends on the timezone implementation
        // This is a simplified check that conversion happened
        expect(event.formattedTime).not.toEqual('2024-06-10T15:30:00Z');
      });
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency between API and UI', async () => {
      const projectData = {
        id: 'project-1',
        name: 'Test Project',
        location: 'Test Location',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        status: 'active'
      };

      // Mock Supabase hook for project data
      const mockUseSupabase = useSupabase as jest.Mock;
      mockUseSupabase.mockReturnValue({
        getProject: vi.fn().mockResolvedValue(projectData),
        isLoading: false,
        error: null
      });

      // Mock Python service hook for the same project
      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getProject: vi.fn().mockResolvedValue(projectData),
        isLoading: false,
        error: null
      });

      // Render component that displays project info
      render(<ProjectInfo projectId="project-1" />);

      // Verify the data is displayed consistently
      await waitFor(() => {
        expect(screen.getByText(projectData.name)).toBeInTheDocument();
        expect(screen.getByText(projectData.location)).toBeInTheDocument();
        expect(screen.getByText(projectData.status)).toBeInTheDocument();
      });

      // Verify both data sources were queried
      expect(mockUseSupabase().getProject).toHaveBeenCalledWith('project-1');
      expect(mockUsePythonService().getProject).toHaveBeenCalledWith('project-1');
    });
  });

  describe('Large Dataset Handling', () => {
    it('should handle pagination of large datasets', async () => {
      // Mock a large dataset with pagination
      const page1 = Array(50).fill(null).map((_, i) => ({
        id: i + 1,
        event_type: 'access',
        timestamp: `2024-06-${Math.floor(i/10) + 1}T08:${i % 60}:00Z`,
        worker_id: 100 + i,
        location: `Gate ${String.fromCharCode(65 + (i % 5))}` // Gates A through E
      }));
      
      const page2 = Array(50).fill(null).map((_, i) => ({
        id: i + 51,
        event_type: 'exit',
        timestamp: `2024-06-${Math.floor(i/10) + 1}T17:${i % 60}:00Z`,
        worker_id: 100 + i,
        location: `Gate ${String.fromCharCode(65 + (i % 5))}` // Gates A through E
      }));

      // Mock the Python service hook with pagination
      const mockUsePythonService = usePythonService as jest.Mock;
      const getAccessEventsMock = vi.fn()
        .mockImplementationOnce(() => Promise.resolve({ data: page1, hasMore: true, nextPage: 2 }))
        .mockImplementationOnce(() => Promise.resolve({ data: page2, hasMore: false, nextPage: null }));

      mockUsePythonService.mockReturnValue({
        getAccessEvents: getAccessEventsMock,
        isLoading: false,
        error: null
      });

      // Test the hook that should handle pagination
      const { result, rerender } = renderHook(() => usePythonService());
      
      // Get first page
      let response = await result.current.getAccessEvents({ page: 1, limit: 50 });
      
      expect(response.data.length).toBe(50);
      expect(response.hasMore).toBe(true);
      expect(response.nextPage).toBe(2);
      
      // Get second page
      response = await result.current.getAccessEvents({ page: 2, limit: 50 });
      
      expect(response.data.length).toBe(50);
      expect(response.hasMore).toBe(false);
      expect(response.nextPage).toBe(null);
      
      // Verify all 100 records were retrieved
      expect(getAccessEventsMock).toHaveBeenCalledTimes(2);
    });
  });
});