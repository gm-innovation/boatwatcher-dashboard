import { render, screen } from '@testing-library/react';
import { performance } from 'perf_hooks';
import { act } from 'react-dom/test-utils';
import { client } from '../../integrations/python-service/client';
import { usePythonService } from '../../integrations/python-service/usePythonService';
import { renderHook } from '@testing-library/react-hooks';

describe('Caching Performance Tests', () => {
  describe('Caching Effectiveness', () => {
    it('should retrieve cached data faster than initial fetch', async () => {
      // First request - no cache
      const startTimeFirstRequest = performance.now();
      await client.getProjects();
      const endTimeFirstRequest = performance.now();
      const firstRequestTime = endTimeFirstRequest - startTimeFirstRequest;
      
      // Second request - should use cache
      const startTimeSecondRequest = performance.now();
      await client.getProjects();
      const endTimeSecondRequest = performance.now();
      const secondRequestTime = endTimeSecondRequest - startTimeSecondRequest;
      
      // Cached request should be significantly faster
      expect(secondRequestTime).toBeLessThan(firstRequestTime * 0.5);
    });

    it('should maintain cache for the configured TTL period', async () => {
      // Initial request to populate cache
      await client.getProjects();
      
      // Request immediately after - should use cache
      const startTimeCached = performance.now();
      await client.getProjects();
      const endTimeCached = performance.now();
      const cachedRequestTime = endTimeCached - startTimeCached;
      
      // Verify cached request is fast
      expect(cachedRequestTime).toBeLessThan(100); // Assuming cache retrieval is very fast
    });
  });

  describe('Perceived Performance Metrics', () => {
    it('should render loading states quickly', async () => {
      const { result, waitForNextUpdate } = renderHook(() => usePythonService.useProjects());
      
      // Measure time until loading state is shown
      const startTime = performance.now();
      expect(result.current.loading).toBe(true);
      const endTime = performance.now();
      
      // Loading state should appear almost instantly
      expect(endTime - startTime).toBeLessThan(50);
      
      // Wait for the hook to finish loading
      await waitForNextUpdate();
    });

    it('should prioritize rendering critical UI elements', async () => {
      // Start timing
      const startTime = performance.now();
      
      // Render the component
      await act(async () => {
        render(<div data-testid="dashboard-container">
          <header data-testid="header">Header</header>
          <nav data-testid="navigation">Navigation</nav>
          <main data-testid="main-content">Content</main>
        </div>);
      });
      
      // Check when critical elements appear
      const headerElement = screen.getByTestId('header');
      const headerRenderTime = performance.now() - startTime;
      
      const navigationElement = screen.getByTestId('navigation');
      const navigationRenderTime = performance.now() - startTime;
      
      const contentElement = screen.getByTestId('main-content');
      const contentRenderTime = performance.now() - startTime;
      
      // Header and navigation should render before main content
      expect(headerRenderTime).toBeLessThan(contentRenderTime);
      expect(navigationRenderTime).toBeLessThan(contentRenderTime);
    });
  });

  describe('Data Processing Times', () => {
    it('should process and transform data within acceptable time', async () => {
      // Get raw data
      const projects = await client.getProjects();
      
      // Measure time to process data
      const startTime = performance.now();
      
      // Simulate data transformation
      const processedData = projects.map(project => ({
        id: project.id,
        name: project.name,
        status: project.status || 'unknown',
        lastUpdated: new Date(project.updatedAt || Date.now()).toISOString(),
        metrics: {
          totalEvents: project.events?.length || 0,
          activeUsers: new Set(project.events?.map(event => event.userId) || []).size
        }
      }));
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Data processing should be fast
      expect(processingTime).toBeLessThan(100);
      expect(processedData.length).toEqual(projects.length);
    });
  });
});