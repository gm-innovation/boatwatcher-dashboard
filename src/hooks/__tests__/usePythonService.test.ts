import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { pythonServiceApi } from '@/integrations/python-service/client';
import { useAccessEvents, useProjects } from '../usePythonService';
import { vi } from 'vitest';

// Mock the python service API
vi.mock('@/integrations/python-service/client', () => ({
  pythonServiceApi: {
    events: {
      getAccessEvents: vi.fn()
    },
    projects: {
      list: vi.fn()
    }
  }
}));

// Mock the toast component
vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn()
}));

// Setup wrapper for testing hooks with React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('usePythonService Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAccessEvents', () => {
    const mockEvents = [
      {
        tipo: 'ENTRADA',
        data: '2024-02-01',
        nomePessoa: 'John Doe',
        cargoPessoa: 'Engineer',
        vinculoColaborador: {
          empresa: 'Test Company'
        },
        alvo: {
          _id: '123',
          nome: 'Test Project'
        }
      }
    ];

    it('should return empty array when no projectId is provided', async () => {
      const { result } = renderHook(() => useAccessEvents(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });
    });

    it('should fetch events when projectId is provided', async () => {
      const mockResponse = { data: { events: mockEvents } };
      (pythonServiceApi.events.getAccessEvents as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useAccessEvents('test-project-id'), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockEvents);
      });
    });

    it('should handle API errors gracefully', async () => {
      (pythonServiceApi.events.getAccessEvents as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() => useAccessEvents('test-project-id'), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });
    });
  });

  describe('useProjects', () => {
    const mockProjects = [
      {
        id: '1',
        name: 'Test Project',
        status: 'active'
      }
    ];

    it('should fetch projects with default parameters', async () => {
      const mockResponse = { data: mockProjects };
      (pythonServiceApi.projects.list as jest.Mock).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useProjects(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockProjects);
      });
    });

    it('should fetch projects with custom parameters', async () => {
      const mockResponse = { data: mockProjects };
      (pythonServiceApi.projects.list as jest.Mock).mockResolvedValueOnce(mockResponse);

      const params = {
        skip: 10,
        limit: 20,
        search: 'test',
        status: 'active',
        client: 'client1',
        forceRefresh: true
      };

      const { result } = renderHook(() => useProjects(params), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(pythonServiceApi.projects.list).toHaveBeenCalledWith({
          ...params,
          force_refresh: params.forceRefresh
        });
      });
    });

    it('should handle API errors gracefully', async () => {
      (pythonServiceApi.projects.list as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const { result } = renderHook(() => useProjects(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });
}));