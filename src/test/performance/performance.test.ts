import { render } from '@testing-library/react';
import { performance } from 'perf_hooks';
import { act } from 'react-dom/test-utils';
import App from '../../App';
import { client } from '../../integrations/python-service/client';

describe('Performance Tests', () => {
  describe('Frontend Load Time', () => {
    it('should load the main app within acceptable time', async () => {
      const startTime = performance.now();
      await act(async () => {
        render(<App />);
      });
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      
      // Assuming 2000ms as acceptable load time threshold
      expect(loadTime).toBeLessThan(2000);
    });
  });

  describe('API Response Times', () => {
    it('should get projects list within acceptable time', async () => {
      const startTime = performance.now();
      await client.getProjects();
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Assuming 1000ms as acceptable API response time threshold
      expect(responseTime).toBeLessThan(1000);
    });

    it('should get access events within acceptable time', async () => {
      const startTime = performance.now();
      await client.getAccessEvents();
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000);
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent API requests efficiently', async () => {
      const startTime = performance.now();
      
      // Simulate multiple concurrent requests
      const requests = [
        client.getProjects(),
        client.getAccessEvents(),
        client.getProjects(),
        client.getAccessEvents()
      ];

      await Promise.all(requests);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Expecting concurrent requests to complete within 2000ms
      expect(totalTime).toBeLessThan(2000);
    });
  });

  describe('Resource Utilization', () => {
    it('should maintain reasonable memory usage during data loading', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform memory-intensive operations
      await act(async () => {
        render(<App />);
      });
      await client.getProjects();
      await client.getAccessEvents();
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Assuming 50MB as acceptable memory increase threshold
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});