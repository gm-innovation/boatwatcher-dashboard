import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react-hooks';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAuth } from '../../hooks/useAuth';
import { useSupabase } from '../../hooks/useSupabase';
import { usePythonService } from '../../hooks/usePythonService';

describe('State Management Tests', () => {
  describe('Store Configuration', () => {
    it('should initialize with default state', async () => {
      const { result } = renderHook(() => useAuth());
      expect(result.current.user).toBe(null);
      expect(result.current.session).toBe(null);
    });

    it('should maintain consistent state across components', async () => {
      const { result: authResult } = renderHook(() => useAuth());
      const { result: supabaseResult } = renderHook(() => useSupabase());
      
      expect(authResult.current.session).toBe(supabaseResult.current.session);
    });
  });

  describe('Reducers and Actions', () => {
    it('should update auth state on login', async () => {
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        await result.current.signIn({
          email: 'test@example.com',
          password: 'password'
        });
      });

      expect(result.current.user).not.toBe(null);
      expect(result.current.session).not.toBe(null);
    });

    it('should clear auth state on logout', async () => {
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        await result.current.signOut();
      });

      expect(result.current.user).toBe(null);
      expect(result.current.session).toBe(null);
    });
  });

  describe('State Synchronization', () => {
    it('should sync state between auth and python service', async () => {
      const { result: authResult } = renderHook(() => useAuth());
      const { result: pythonResult } = renderHook(() => usePythonService());

      await act(async () => {
        await authResult.current.signIn({
          email: 'test@example.com',
          password: 'password'
        });
      });

      expect(pythonResult.current.isAuthenticated).toBe(true);
    });

    it('should maintain state consistency during navigation', async () => {
      const { result: authResult } = renderHook(() => useAuth());
      
      await act(async () => {
        await authResult.current.signIn({
          email: 'test@example.com',
          password: 'password'
        });
      });

      // Simulate navigation
      const { result: newAuthResult } = renderHook(() => useAuth());
      expect(newAuthResult.current.user).toEqual(authResult.current.user);
    });
  });
});