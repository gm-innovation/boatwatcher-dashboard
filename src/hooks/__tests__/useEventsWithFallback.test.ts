import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEventsWithFallback } from '../useEventsWithFallback';
import { getAccessEventsWithFallback } from '@/lib/api-fallback';
import { vi } from 'vitest';

// Mock the api-fallback module
vi.mock('@/lib/api-fallback', () => ({
  getAccessEventsWithFallback: vi.fn()
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

describe('useEventsWithFallback Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
        _id: '5e95cef20def48003a432b33', // Valid location ID for BEN MOINHOS SMART LIFE
        nome: 'Test Project'
      }
    },
    {
      tipo: 'ENTRADA_COM_PENDENCIAS',
      data: '2024-02-02',
      nomePessoa: 'Jane Smith',
      cargoPessoa: 'Designer',
      vinculoColaborador: {
        empresa: 'Design Co'
      },
      alvo: {
        _id: '5e95cef20def48003a432b33', // Valid location ID for BEN MOINHOS SMART LIFE
        nome: 'Test Project'
      }
    },
    {
      tipo: 'SAIDA', // This should be filtered out
      data: '2024-02-03',
      nomePessoa: 'Bob Johnson',
      cargoPessoa: 'Manager',
      vinculoColaborador: {
        empresa: 'Management Inc'
      },
      alvo: {
        _id: '5e95cef20def48003a432b33',
        nome: 'Test Project'
      }
    },
    {
      tipo: 'ENTRADA',
      data: '2024-02-04',
      nomePessoa: 'Alice Brown',
      cargoPessoa: 'Developer',
      vinculoColaborador: {
        empresa: 'Dev Corp'
      },
      alvo: {
        _id: 'invalid-location', // This should be filtered out
        nome: 'Test Project'
      }
    }
  ];

  it('should return empty array when no projectId is provided', async () => {
    const { result } = renderHook(() => useEventsWithFallback(), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
  });

  it('should fetch and filter events when projectId is provided', async () => {
    (getAccessEventsWithFallback as jest.Mock).mockResolvedValueOnce(mockEvents);

    const projectId = 'cb9babbc-c77f-40db-a0b7-f3187b4659fb'; // BEN MOINHOS SMART LIFE
    const { result } = renderHook(() => useEventsWithFallback(projectId), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      // Only the first two events should pass filtering (ENTRADA and ENTRADA_COM_PENDENCIAS with valid location)
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[0].tipo).toBe('ENTRADA');
      expect(result.current.data[1].tipo).toBe('ENTRADA_COM_PENDENCIAS');
    });
  });

  it('should handle API errors gracefully', async () => {
    (getAccessEventsWithFallback as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

    const projectId = 'cb9babbc-c77f-40db-a0b7-f3187b4659fb';
    const { result } = renderHook(() => useEventsWithFallback(projectId), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(result.current.data).toEqual([]);
    });
  });

  it('should call getAccessEventsWithFallback with correct parameters', async () => {
    (getAccessEventsWithFallback as jest.Mock).mockResolvedValueOnce([]);

    const projectId = 'cb9babbc-c77f-40db-a0b7-f3187b4659fb';
    renderHook(() => useEventsWithFallback(projectId), {
      wrapper: createWrapper()
    });

    await waitFor(() => {
      expect(getAccessEventsWithFallback).toHaveBeenCalledWith({
        start_date: expect.any(String),
        end_date: expect.any(String),
        project_id: projectId
      });
    });
  });
});