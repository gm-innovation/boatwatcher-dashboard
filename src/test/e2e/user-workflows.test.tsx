import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '../../lib/store';
import App from '../../App';

describe('User Workflows', () => {
  const renderApp = () => {
    render(
      <Provider store={store}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </Provider>
    );
  };

  describe('User Registration and Onboarding', () => {
    test('completes registration process successfully', async () => {
      renderApp();
      
      // Navigate to registration page
      const registerLink = screen.getByText(/register/i);
      fireEvent.click(registerLink);
      
      // Fill registration form
      await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
      await userEvent.type(screen.getByLabelText(/password/i), 'Test123!');
      await userEvent.type(screen.getByLabelText(/confirm password/i), 'Test123!');
      
      // Submit form
      const submitButton = screen.getByRole('button', { name: /register/i });
      fireEvent.click(submitButton);
      
      // Verify successful registration
      await waitFor(() => {
        expect(screen.getByText(/registration successful/i)).toBeInTheDocument();
      });
    });
  });

  describe('Project Management', () => {
    test('creates and manages a new project', async () => {
      renderApp();
      
      // Navigate to projects page
      const projectsLink = screen.getByText(/projects/i);
      fireEvent.click(projectsLink);
      
      // Create new project
      const createButton = screen.getByRole('button', { name: /create project/i });
      fireEvent.click(createButton);
      
      // Fill project details
      await userEvent.type(screen.getByLabelText(/project name/i), 'Test Project');
      await userEvent.type(screen.getByLabelText(/description/i), 'Test Description');
      
      // Submit project
      const submitButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(submitButton);
      
      // Verify project creation
      await waitFor(() => {
        expect(screen.getByText('Test Project')).toBeInTheDocument();
      });
    });
  });

  describe('Dashboard Navigation', () => {
    test('navigates through dashboard sections', async () => {
      renderApp();
      
      // Navigate to dashboard
      const dashboardLink = screen.getByText(/dashboard/i);
      fireEvent.click(dashboardLink);
      
      // Verify dashboard components
      expect(screen.getByText(/summary/i)).toBeInTheDocument();
      expect(screen.getByText(/statistics/i)).toBeInTheDocument();
      
      // Test filters
      const filterButton = screen.getByRole('button', { name: /filter/i });
      fireEvent.click(filterButton);
      
      // Apply date filter
      const dateFilter = screen.getByLabelText(/date range/i);
      fireEvent.click(dateFilter);
      
      // Verify filtered results
      await waitFor(() => {
        expect(screen.getByText(/filtered results/i)).toBeInTheDocument();
      });
    });
  });

  describe('Report Generation', () => {
    test('generates and exports reports', async () => {
      renderApp();
      
      // Navigate to reports section
      const reportsLink = screen.getByText(/reports/i);
      fireEvent.click(reportsLink);
      
      // Select report type
      const reportTypeSelect = screen.getByLabelText(/report type/i);
      fireEvent.change(reportTypeSelect, { target: { value: 'monthly' } });
      
      // Generate report
      const generateButton = screen.getByRole('button', { name: /generate/i });
      fireEvent.click(generateButton);
      
      // Verify report generation
      await waitFor(() => {
        expect(screen.getByText(/report generated/i)).toBeInTheDocument();
      });
      
      // Test export functionality
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      // Verify export
      await waitFor(() => {
        expect(screen.getByText(/export successful/i)).toBeInTheDocument();
      });
    });
  });

  describe('User Settings', () => {
    test('updates user preferences', async () => {
      renderApp();
      
      // Navigate to settings
      const settingsLink = screen.getByText(/settings/i);
      fireEvent.click(settingsLink);
      
      // Update notification preferences
      const notificationToggle = screen.getByRole('switch', { name: /notifications/i });
      fireEvent.click(notificationToggle);
      
      // Update theme preference
      const themeSelect = screen.getByLabelText(/theme/i);
      fireEvent.change(themeSelect, { target: { value: 'dark' } });
      
      // Save preferences
      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      fireEvent.click(saveButton);
      
      // Verify settings update
      await waitFor(() => {
        expect(screen.getByText(/settings saved/i)).toBeInTheDocument();
      });
    });
  });
});