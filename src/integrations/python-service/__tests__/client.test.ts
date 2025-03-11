import { vi } from 'vitest';
import axios from 'axios';
import { pythonServiceApi } from '../client';

// Mock axios
vi.mock('axios', () => ({
  create: vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  }))
}));

describe('Python Service API Client', () => {
  const mockAxiosInstance = axios.create();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Health Check', () => {
    it('should make a GET request to /health endpoint', async () => {
      await pythonServiceApi.health();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health');
    });
  });

  describe('Events API', () => {
    const mockEventParams = {
      start_date: '2024-01-01',
      end_date: '2024-02-01',
      project_id: 'test-project-id'
    };

    it('should make a POST request to /events/access with correct parameters', async () => {
      await pythonServiceApi.events.getAccessEvents(mockEventParams);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/events/access', mockEventParams);
    });
  });

  describe('Projects API', () => {
    it('should make a GET request to /projects with query parameters', async () => {
      const params = {
        skip: 0,
        limit: 10,
        search: 'test',
        status: 'active',
        client: 'client1',
        force_refresh: true
      };

      await pythonServiceApi.projects.list(params);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/projects', { params });
    });

    it('should make a GET request to /projects/:id with force refresh parameter', async () => {
      const projectId = 'test-project-id';
      const forceRefresh = true;

      await pythonServiceApi.projects.getById(projectId, forceRefresh);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/projects/${projectId}`, {
        params: { force_refresh: forceRefresh }
      });
    });

    it('should make a GET request to /projects/:id/events with date parameters', async () => {
      const projectId = 'test-project-id';
      const params = {
        start_date: '2024-01-01',
        end_date: '2024-02-01'
      };

      await pythonServiceApi.projects.getEvents(projectId, params);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/projects/${projectId}/events`,
        { params }
      );
    });
  });
});