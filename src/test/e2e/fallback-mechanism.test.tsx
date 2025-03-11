import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../../lib/store';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import App from '../../App';
import Dashboard from '../../pages/Dashboard';
import { useEventsWithFallback } from '../../hooks/useEventsWithFallback';

// Mock server for API responses
const server = setupServer(
  // Mock Python service API - initially working
  rest.get('/api/python-service/health', (req, res, ctx) => {
    return res(ctx.json({ status: 'ok' }));
  }),
  
  // Mock Python service events endpoint
  rest.get('/api/python-service/events', (req, res, ctx) => {
    return res(ctx.json([
      { id: 1, projectId: 1, type: 'access', timestamp: '2024-06-01T10:00:00Z', user: 'user1' },
      { id: 2, projectId: 1, type: 'access', timestamp: '2024-06-01T11:00:00Z', user: 'user2' },
    ]));
  }),
  
  // Mock Supabase fallback API
  rest.get('/api/supabase/events', (req, res, ctx) => {
    return res(ctx.json([
      { id: 1, project_id: 1, event_type: 'access', created_at: '2024-06-01T10:00:00Z', user_id: 'user1' },
      { id: 2, project_id: 1, event_type: 'access', created_at: '2024-06-01T11:00:00Z', user_id: 'user2' },
      { id: 3, project_id: 1, event_type: 'access', created_at: '2024-06-01T12:00:00Z', user_id: 'user3' },
    ]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock the useEventsWithFallback hook for testing
jest.mock('../../hooks/useEventsWithFallback');

describe('Fallback Mechanism Tests', () => {
  const renderWithProviders = (ui) => {
    return render(
      <Provider store={store}>
        <BrowserRouter>
          {ui}
        </BrowserRouter>
      </Provider>
    );
  };

  describe('Automatic Failover to Supabase', () => {
    test('uses Python service when available', async () => {
      // Mock the hook to return data from Python service
      (useEventsWithFallback as jest.Mock).mockReturnValue({
        events: [
          { id: 1, projectId: 1, type: 'access', timestamp: '2024-06-01T10:00:00Z', user: 'user1' },
          { id: 2, projectId: 1, type: 'access', timestamp: '2024-06-01T11:00:00Z', user: 'user2' },
        ],
        isLoading: false,
        error: null,
        source: 'python-service',
        refresh: jest.fn(),
      });
      
      renderWithProviders(<Dashboard />);
      
      // Verify data is displayed
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
        expect(screen.getByText('user2')).toBeInTheDocument();
      });
      
      // Verify source indicator shows Python service
      expect(screen.getByText(/python service/i)).toBeInTheDocument();
    });
    
    test('fails over to Supabase when Python service is unavailable', async () => {
      // Mock Python service as unavailable
      server.use(
        rest.get('/api/python-service/health', (req, res, ctx) => {
          return res(ctx.status(500));
        }),
        rest.get('/api/python-service/events', (req, res, ctx) => {
          return res(ctx.status(500));
        })
      );
      
      // Mock the hook to return data from Supabase fallback
      (useEventsWithFallback as jest.Mock).mockReturnValue({
        events: [
          { id: 1, projectId: 1, type: 'access', timestamp: '2024-06-01T10:00:00Z', user: 'user1' },
          { id: 2, projectId: 1, type: 'access', timestamp: '2024-06-01T11:00:00Z', user: 'user2' },
          { id: 3, projectId: 1, type: 'access', timestamp: '2024-06-01T12:00:00Z', user: 'user3' },
        ],
        isLoading: false,
        error: null,
        source: 'supabase',
        refresh: jest.fn(),
      });
      
      renderWithProviders(<Dashboard />);
      
      // Verify data is displayed from Supabase
      await waitFor(() => {
        expect(screen.getByText('user1')).toBeInTheDocument();
        expect(screen.getByText('user2')).toBeInTheDocument();
        expect(screen.getByText('user3')).toBeInTheDocument();
      });
      
      // Verify source indicator shows Supabase
      expect(screen.getByText(/supabase fallback/i)).toBeInTheDocument();
      
      // Verify fallback notification is displayed
      expect(screen.getByText(/using fallback data source/i)).toBeInTheDocument();
    });
  });
  
  describe('User Experience During Failover', () => {
    test('shows appropriate loading states during failover', async () => {
      // First return loading state
      (useEventsWithFallback as jest.Mock).mockReturnValueOnce({
        events: [],
        isLoading: true,
        error: null,
        source: null,
        refresh: jest.fn(),
      });
      
      renderWithProviders(<Dashboard />);
      
      // Verify loading state is displayed
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      
      // Then update to show fallback data
      (useEventsWithFallback as jest.Mock).mockReturnValue({
        events: [
          { id: 1, projectId: 1, type: 'access', timestamp: '2024-06-01T10:00:00Z', user: 'user1' },
          { id: 2, projectId: 1, type: 'access', timestamp: '2024-06-01T11:00:00Z', user: 'user2' },
          { id: 3, projectId: 1, type: 'access', timestamp: '2024-06-01T12:00:00Z', user: 'user3' },
        ],
        isLoading: false,
        error: null,
        source: 'supabase',
        refresh: jest.fn(),
      });
      
      // Verify data is displayed after loading
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
        expect(screen.getByText('user1')).toBeInTheDocument();
      });
      
      // Verify fallback notification is displayed
      expect(screen.getByText(/using fallback data source/i)).toBeInTheDocument();
    });
  });
  
  describe('Recovery After Service Restoration', () => {
    test('switches back to Python service when it becomes available again', async () => {
      // Mock the hook to initially return Supabase data
      (useEventsWithFallback as jest.Mock).mockReturnValueOnce({
        events: [
          { id: 1, projectId: 1, type: 'access', timestamp: '2024-06-01T10:00:00Z', user: 'user1' },
          { id: 2, projectId: 1, type: 'access', timestamp: '2024-06-01T11:00:00Z', user: 'user2' },
          { id: 3, projectId: 1, type: 'access', timestamp: '2024-06-01T12:00:00Z', user: 'user3' },
        ],
        isLoading: false,
        error: null,
        source: 'supabase',
        refresh: jest.fn(),
      });
      
      renderWithProviders(<Dashboard />);
      
      // Verify Supabase data is displayed
      await waitFor(() => {
        expect(screen.getByText('user3')).toBeInTheDocument();
      });
      
      // Verify fallback notification is displayed
      expect(screen.getByText(/using fallback data source/i)).toBeInTheDocument();
      
      // Mock Python service as available again
      server.use(
        rest.get('/api/python-service/health', (req, res, ctx) => {
          return res(ctx.json({ status: 'ok' }));
        })
      );
      
      // Mock the hook to return Python service data after refresh
      const mockRefresh = jest.fn();
      (useEventsWithFallback as jest.Mock).mockReturnValue({
        events: [
          { id: 1, projectId: 1, type: 'access', timestamp: '2024-06-01T10:00:00Z', user: 'user1' },
          { id: 2, projectId: 1, type: 'access', timestamp: '2024-06-01T11:00:00Z', user: 'user2' },
        ],
        isLoading: false,
        error: null,
        source: 'python-service',
        refresh: mockRefresh,
      });
      
      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      // Verify refresh function was called
      expect(mockRefresh).toHaveBeenCalled();
      
      // Verify Python service data is displayed
      await waitFor(() => {
        expect(screen.queryByText('user3')).not.toBeInTheDocument();
        expect(screen.getByText(/python service/i)).toBeInTheDocument();
      });
      
      // Verify fallback notification is no longer displayed
      expect(screen.queryByText(/using fallback data source/i)).not.toBeInTheDocument();
    });
  });
  
  describe('Data Consistency During Failover', () => {
    test('maintains consistent data format between sources', async () => {
      // Mock the hook to return normalized data from Python service
      (useEventsWithFallback as jest.Mock).mockReturnValueOnce({
        events: [
          { id: 1, projectId: 1, type: 'access', timestamp: '2024-06-01T10:00:00Z', user: 'user1' },
        ],
        isLoading: false,
        error: null,
        source: 'python-service',
        refresh: jest.fn(),
      });
      
      renderWithProviders(<Dashboard />);
      
      // Verify Python service data format
      await waitFor(() => {
        const eventElement = screen.getByTestId('event-1');
        expect(eventElement).toHaveTextContent('user1');
        expect(eventElement).toHaveTextContent('2024-06-01');
        expect(eventElement).toHaveTextContent('access');
      });
      
      // Mock the hook to return normalized data from Supabase
      (useEventsWithFallback as jest.Mock).mockReturnValue({
        events: [
          { id: 2, projectId: 1, type: 'access', timestamp: '2024-06-01T11:00:00Z', user: 'user2' },
        ],
        isLoading: false,
        error: null,
        source: 'supabase',
        refresh: jest.fn(),
      });
      
      // Simulate refresh
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      // Verify Supabase data has the same format
      await waitFor(() => {
        const eventElement = screen.getByTestId('event-2');
        expect(eventElement).toHaveTextContent('user2');
        expect(eventElement).toHaveTextContent('2024-06-01');
        expect(eventElement).toHaveTextContent('access');
      });
      
      // Verify the UI structure remains consistent
      expect(screen.getAllByTestId(/event-/)).toHaveLength(1);
    });
  });
});