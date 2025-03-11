import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { pythonServiceApi } from '@/integrations/python-service/client';
import { useProject } from '../usePythonService';
import { toast } from '@/components/ui/use-toast';
import { vi } from 'vitest';

// Mock the python service API
vi.mock('@/integrations/python-service/client', () => ({
  pythonServiceApi: {
    projects: {
      getById: vi.fn()
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

describe('useProject Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProject = {
    id: 'test-project-id',
    name: 'Test Project',
    status: 'active',
    client: 'Test Client',
    location: 'Test Location',
    startDate: '2024-01-01',
    endDate: '2024-12-31'
  };

  it('should fetch project data when projectId is provided', async () => {
    const mockResponse = { data: mockProject };
    (pythonServiceApi.projects.getById as jest.Mock).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useProject('test-project-id'), {
      wrapper: createWrapper()
    });

    // Initially in loading state
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockProject);
    expect(pythonServiceApi.projects.getById).toHaveBeenCalledWith('test-project-id', false);
  });

  it('should pass forceRefresh parameter when provided', async () => {
    const mockResponse = { data: mockProject };
    (pythonServiceApi.projects.getById as jest.Mock).mockResolvedValueOnce(mockResponse);

    renderHook(() => useProject('test-project-id', true), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(pythonServiceApi.projects.getById).toHaveBeenCalledWith('test-project-id', true);
    });
  });

  it('should handle API errors gracefully', async () => {
    const error = new Error('API Error');
    (pythonServiceApi.projects.getById as jest.Mock).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useProject('test-project-id'), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Erro ao buscar projeto',
      variant: 'destructive'
    }));
  });

  it('should update data when query is invalidated', async () => {
    // First response
    const initialProject = { ...mockProject, name: 'Initial Name' };
    (pythonServiceApi.projects.getById as jest.Mock).mockResolvedValueOnce({ 
      data: initialProject 
    });

    const { result, rerender } = renderHook(() => useProject('test-project-id'), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(initialProject);

    // Second response after invalidation
    const updatedProject = { ...mockProject, name: 'Updated Name' };
    (pythonServiceApi.projects.getById as jest.Mock).mockResolvedValueOnce({ 
      data: updatedProject 
    });

    // Simulate query invalidation
    result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toEqual(updatedProject);
    });
  });
});