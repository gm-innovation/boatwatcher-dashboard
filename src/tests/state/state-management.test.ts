import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useSupabase } from '../../hooks/useSupabase';
import { useAuth } from '../../hooks/useAuth';

describe('State Management Tests', () => {
  describe('Store Configuration', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useSupabase());
      expect(result.current).toBeDefined();
      expect(result.current.client).toBeDefined();
    });

    it('should maintain consistent state across re-renders', () => {
      const { result, rerender } = renderHook(() => useSupabase());
      const initialClient = result.current.client;
      
      rerender();
      expect(result.current.client).toBe(initialClient);
    });
  });

  describe('Reducers and Actions', () => {
    it('should update auth state on login', async () => {
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      expect(result.current.user).toBeDefined();
      expect(result.current.session).toBeDefined();
    });

    it('should clear auth state on logout', async () => {
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  describe('State Synchronization', () => {
    it('should synchronize auth state across components', async () => {
      const { result: authHook } = renderHook(() => useAuth());
      const { result: supabaseHook } = renderHook(() => useSupabase());
      
      await act(async () => {
        await authHook.current.login('test@example.com', 'password');
      });

      expect(authHook.current.user).toBeDefined();
      expect(supabaseHook.current.client.auth.user()).toBeDefined();
    });

    it('should maintain consistent state after multiple actions', async () => {
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      const initialUser = result.current.user;

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(result.current.user).toEqual(initialUser);
    });
  });
});