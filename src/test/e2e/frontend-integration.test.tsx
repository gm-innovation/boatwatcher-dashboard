import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../../lib/store';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import App from '../../App';
import Dashboard from '../../pages/Dashboard';
import ProjectDetails from '../../pages/ProjectDetails';

// Mock server for API responses
const server = setupServer(
  // Mock projects API
  rest.get('/api/projects', (req, res, ctx) => {
    return res(ctx.json([
      { id: 1, name: 'Project Alpha', description: 'Test project 1' },
      { id: 2, name: 'Project Beta', description: 'Test project 2' },
    ]));
  }),
  
  // Mock single project API
  rest.get('/api/projects/:id', (req, res, ctx) => {
    const { id } = req.params;
    return res(ctx.json({
      id: Number(id),
      name: id === '1' ? 'Project Alpha' : 'Project Beta',
      description: `Test project ${id}`,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      status: 'active',
    }));
  }),
  
  // Mock events API
  rest.get('/api/events', (req, res, ctx) => {
    return res(ctx.json([
      { id: 1, projectId: 1, type: 'access', timestamp: '2024-06-01T10:00:00Z', user: 'user1' },
      { id: 2, projectId: 1, type: 'access', timestamp: '2024-06-01T11:00:00Z', user: 'user2' },
      { id: 3, projectId: 2, type: 'access', timestamp: '2024-06-01T12:00:00Z', user: 'user1' },
    ]));
  }),
  
  // Mock error response for testing error handling
  rest.get('/api/error-test', (req, res, ctx) => {
    return res(ctx.status(500), ctx.json({ message: 'Server error' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Frontend Integration Tests', () => {
  const renderWithProviders = (ui) => {
    return render(
      <Provider store={store}>
        <BrowserRouter>
          {ui}
        </BrowserRouter>
      </Provider>
    );
  };

  describe('Component Rendering with Live Data', () => {
    test('renders dashboard with live project data', async () => {
      renderWithProviders(<Dashboard />);
      
      // Check loading state
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      });
      
      // Verify project data is displayed
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
    });
    
    test('renders project details with live data', async () => {
      // Mock router params
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useParams: () => ({ id: '1' }),
      }));
      
      renderWithProviders(<ProjectDetails />);
      
      // Check loading state
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      });
      
      // Verify project details are displayed
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Test project 1')).toBeInTheDocument();
      expect(screen.getByText('2024-01-01')).toBeInTheDocument();
      expect(screen.getByText('2024-12-31')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });
  });
  
  describe('Loading States and Spinners', () => {
    test('displays loading state during data fetch', async () => {
      // Delay API response to ensure loading state is visible
      server.use(
        rest.get('/api/projects', (req, res, ctx) => {
          return res(ctx.delay(500), ctx.json([
            { id: 1, name: 'Project Alpha', description: 'Test project 1' },
            { id: 2, name: 'Project Beta', description: 'Test project 2' },
          ]));
        })
      );
      
      renderWithProviders(<Dashboard />);
      
      // Verify loading state is displayed
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      expect(screen.getByText(/loading projects/i)).toBeInTheDocument();
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      }, { timeout: 1000 });
      
      // Verify data is displayed after loading
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });
  });
  
  describe('Error Messages and Toasts', () => {
    test('displays error message when API fails', async () => {
      // Mock API error
      server.use(
        rest.get('/api/projects', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ message: 'Failed to fetch projects' }));
        })
      );
      
      renderWithProviders(<Dashboard />);
      
      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/failed to fetch projects/i)).toBeInTheDocument();
      });
      
      // Verify error UI elements
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/try again/i)).toBeInTheDocument();
    });
    
    test('allows retry after error', async () => {
      // First request fails, second succeeds
      let requestCount = 0;
      server.use(
        rest.get('/api/projects', (req, res, ctx) => {
          requestCount++;
          if (requestCount === 1) {
            return res(ctx.status(500), ctx.json({ message: 'Failed to fetch projects' }));
          } else {
            return res(ctx.json([
              { id: 1, name: 'Project Alpha', description: 'Test project 1' },
            ]));
          }
        })
      );
      
      renderWithProviders(<Dashboard />);
      
      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/failed to fetch projects/i)).toBeInTheDocument();
      });
      
      // Click retry button
      const retryButton = screen.getByText(/try again/i);
      fireEvent.click(retryButton);
      
      // Verify loading state after retry
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      
      // Wait for successful data load
      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });
    });
  });
  
  describe('User Interactions', () => {
    test('filters data based on user input', async () => {
      renderWithProviders(<Dashboard />);
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });
      
      // Enter search term
      const searchInput = screen.getByPlaceholderText(/search projects/i);
      await userEvent.type(searchInput, 'Alpha');
      
      // Verify filtered results
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
    });
    
    test('sorts data when column headers are clicked', async () => {
      renderWithProviders(<Dashboard />);
      
      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });
      
      // Click on name column header to sort
      const nameHeader = screen.getByText(/project name/i);
      fireEvent.click(nameHeader);
      
      // Verify sort indicator appears
      expect(screen.getByTestId('sort-indicator')).toBeInTheDocument();
      
      // Click again to reverse sort
      fireEvent.click(nameHeader);
      
      // Verify sort indicator changes direction
      expect(screen.getByTestId('sort-indicator-desc')).toBeInTheDocument();
    });
  });
  
  describe('Data Updates and Refresh', () => {
    test('refreshes data when refresh button is clicked', async () => {
      let refreshCount = 0;
      server.use(
        rest.get('/api/projects', (req, res, ctx) => {
          refreshCount++;
          if (refreshCount === 1) {
            return res(ctx.json([
              { id: 1, name: 'Project Alpha', description: 'Test project 1' },
            ]));
          } else {
            return res(ctx.json([
              { id: 1, name: 'Project Alpha', description: 'Test project 1' },
              { id: 2, name: 'Project Beta', description: 'Test project 2' },
              { id: 3, name: 'Project Gamma', description: 'Test project 3' },
            ]));
          }
        })
      );
      
      renderWithProviders(<Dashboard />);
      
      // Wait for initial data to load
      await waitFor(() => {
        expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      });
      
      // Verify only one project is initially displayed
      expect(screen.queryByText('Project Beta')).not.toBeInTheDocument();
      
      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);
      
      // Verify loading state during refresh
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
      
      // Wait for refreshed data
      await waitFor(() => {
        expect(screen.getByText('Project Gamma')).toBeInTheDocument();
      });
      
      // Verify all three projects are now displayed
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
      expect(screen.getByText('Project Beta')).toBeInTheDocument();
      expect(screen.getByText('Project Gamma')).toBeInTheDocument();
    });
  });
});