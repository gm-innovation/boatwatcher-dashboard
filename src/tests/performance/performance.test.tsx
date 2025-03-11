import { render, screen } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { performance } from 'perf_hooks';
import { ProjectInfo } from '../../components/ProjectInfo';
import { SummaryCards } from '../../components/SummaryCards';
import { WorkersList } from '../../components/WorkersList';
import { client } from '../../integrations/python-service/client';

describe('Performance Tests', () => {
  describe('Frontend Load Time', () => {
    it('should load ProjectInfo component within acceptable time', async () => {
      const startTime = performance.now();
      await act(async () => {
        render(<ProjectInfo projectId="test-project" />);
      });
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(1000); // 1 second threshold
    });

    it('should load SummaryCards component within acceptable time', async () => {
      const startTime = performance.now();
      await act(async () => {
        render(<SummaryCards projectId="test-project" />);
      });
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(800); // 800ms threshold
    });

    it('should load WorkersList component within acceptable time', async () => {
      const startTime = performance.now();
      await act(async () => {
        render(<WorkersList projectId="test-project" />);
      });
      const endTime = performance.now();
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(1200); // 1.2 second threshold
    });
  });

  describe('API Response Times', () => {
    it('should get project details within acceptable time', async () => {
      const startTime = performance.now();
      await client.getProject('test-project');
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(500); // 500ms threshold
    });

    it('should get access events within acceptable time', async () => {
      const startTime = performance.now();
      await client.getAccessEvents('test-project');
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(800); // 800ms threshold
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent API requests', async () => {
      const startTime = performance.now();
      await Promise.all([
        client.getProject('test-project-1'),
        client.getProject('test-project-2'),
        client.getProject('test-project-3'),
        client.getAccessEvents('test-project-1'),
        client.getAccessEvents('test-project-2')
      ]);
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(2000); // 2 second threshold for concurrent requests
    });
  });

  describe('Resource Utilization', () => {
    it('should maintain acceptable memory usage during component rendering', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      await act(async () => {
        render(
          <>
            <ProjectInfo projectId="test-project" />
            <SummaryCards projectId="test-project" />
            <WorkersList projectId="test-project" />
          </>
        );
      });

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Ensure memory increase is less than 50MB
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should efficiently handle large datasets', async () => {
      const startTime = performance.now();
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `worker-${i}`,
        name: `Worker ${i}`,
        status: i % 2 === 0 ? 'active' : 'inactive'
      }));

      await act(async () => {
        render(<WorkersList projectId="test-project" initialData={largeDataset} />);
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;
      expect(renderTime).toBeLessThan(2000); // 2 second threshold for large dataset
    });
  });
}));