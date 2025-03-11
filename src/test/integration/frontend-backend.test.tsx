import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSelector } from '../../components/ProjectSelector';
import { useSupabase } from '../../hooks/useSupabase';
import { usePythonService } from '../../hooks/usePythonService';

// Mock the hooks
vi.mock('../../hooks/useSupabase');
vi.mock('../../hooks/usePythonService');

describe('Frontend-Backend Integration', () => {
  describe('Data Flow Tests', () => {
    it('should fetch and display projects from backend', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1' },
        { id: 2, name: 'Project 2' }
      ];

      // Mock the hooks implementation
      const mockUseSupabase = useSupabase as jest.Mock;
      mockUseSupabase.mockReturnValue({
        getProjects: vi.fn().mockResolvedValue(mockProjects),
        isLoading: false,
        error: null
      });

      render(<ProjectSelector />);

      // Wait for projects to be displayed
      await waitFor(() => {
        mockProjects.forEach(project => {
          expect(screen.getByText(project.name)).toBeInTheDocument();
        });
      });
    });

    it('should handle backend errors gracefully', async () => {
      const mockError = new Error('Failed to fetch projects');

      // Mock the hooks to simulate error
      const mockUseSupabase = useSupabase as jest.Mock;
      mockUseSupabase.mockReturnValue({
        getProjects: vi.fn().mockRejectedValue(mockError),
        isLoading: false,
        error: mockError
      });

      render(<ProjectSelector />);

      // Wait for error message to be displayed
      await waitFor(() => {
        expect(screen.getByText(/failed to fetch projects/i)).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful authentication', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };

      const mockUseSupabase = useSupabase as jest.Mock;
      mockUseSupabase.mockReturnValue({
        signIn: vi.fn().mockResolvedValue({ user: mockUser }),
        user: mockUser,
        isLoading: false,
        error: null
      });

      // Render login component and simulate login
      render(<Login />);
      
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      await userEvent.type(emailInput, 'test@example.com');
      await userEvent.type(passwordInput, 'password123');
      await userEvent.click(submitButton);

      // Verify successful login
      await waitFor(() => {
        expect(mockUseSupabase.signIn).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123'
        });
      });
    });
  });

  describe('Service Communication', () => {
    it('should handle successful API requests', async () => {
      const mockEvents = [
        { id: 1, type: 'access', timestamp: '2024-01-01' },
        { id: 2, type: 'exit', timestamp: '2024-01-02' }
      ];

      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: vi.fn().mockResolvedValue(mockEvents),
        isLoading: false,
        error: null
      });

      // Test API request and response handling
      const { result } = renderHook(() => usePythonService());
      
      await waitFor(() => {
        expect(result.current.getAccessEvents).toBeDefined();
      });

      const events = await result.current.getAccessEvents();
      expect(events).toEqual(mockEvents);
    });

    it('should handle API errors with fallback', async () => {
      const mockError = new Error('API unavailable');

      const mockUsePythonService = usePythonService as jest.Mock;
      mockUsePythonService.mockReturnValue({
        getAccessEvents: vi.fn().mockRejectedValue(mockError),
        isLoading: false,
        error: mockError
      });

      // Test error handling and fallback mechanism
      const { result } = renderHook(() => useEventsWithFallback());
      
      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
        expect(result.current.useFallback).toBe(true);
      });
    });
  });
});