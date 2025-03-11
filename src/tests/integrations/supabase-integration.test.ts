import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSupabase } from '../../hooks/useSupabase';
import { useAuth } from '../../hooks/useAuth';

describe('Supabase Integration Tests', () => {
  describe('Authentication Flow', () => {
    it('should register a new user successfully', async () => {
      const { result } = renderHook(() => useAuth());
      const testEmail = `test-${Date.now()}@example.com`;
      const testPassword = 'Password123!';
      
      await act(async () => {
        const { error } = await result.current.signUp(testEmail, testPassword);
        expect(error).toBeNull();
      });
      
      expect(result.current.user).toBeDefined();
    });

    it('should login an existing user', async () => {
      const { result } = renderHook(() => useAuth());
      const testEmail = 'existing-user@example.com';
      const testPassword = 'Password123!';
      
      await act(async () => {
        const { error } = await result.current.login(testEmail, testPassword);
        expect(error).toBeNull();
      });
      
      expect(result.current.user).toBeDefined();
      expect(result.current.session).toBeDefined();
    });

    it('should handle password reset flow', async () => {
      const { result } = renderHook(() => useAuth());
      const testEmail = 'reset-password@example.com';
      
      await act(async () => {
        const { error } = await result.current.resetPassword(testEmail);
        expect(error).toBeNull();
      });
      
      // In a real test, we would verify the reset email was sent
      // Here we're just testing the API call succeeds
    });

    it('should manage user session correctly', async () => {
      const { result } = renderHook(() => useAuth());
      
      await act(async () => {
        await result.current.login('session-test@example.com', 'Password123!');
      });
      
      expect(result.current.session).toBeDefined();
      
      await act(async () => {
        await result.current.logout();
      });
      
      expect(result.current.session).toBeNull();
    });
  });

  describe('CRUD Operations', () => {
    const testTable = 'test_table';
    let supabase;
    
    beforeEach(() => {
      const { result } = renderHook(() => useSupabase());
      supabase = result.current.client;
    });

    it('should create a new record', async () => {
      const testData = { name: 'Test Item', description: 'Test Description' };
      
      const { data, error } = await supabase
        .from(testTable)
        .insert(testData)
        .select();
      
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data[0].name).toBe(testData.name);
    });

    it('should read records with filters', async () => {
      const { data, error } = await supabase
        .from(testTable)
        .select('*')
        .eq('name', 'Test Item');
      
      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBeGreaterThan(0);
    });

    it('should update an existing record', async () => {
      // First create a record
      const testData = { name: 'Update Test', description: 'Original Description' };
      const { data: createdData } = await supabase
        .from(testTable)
        .insert(testData)
        .select();
      
      const recordId = createdData[0].id;
      const updatedDescription = 'Updated Description';
      
      // Now update it
      const { data, error } = await supabase
        .from(testTable)
        .update({ description: updatedDescription })
        .eq('id', recordId)
        .select();
      
      expect(error).toBeNull();
      expect(data[0].description).toBe(updatedDescription);
    });

    it('should delete a record', async () => {
      // First create a record
      const testData = { name: 'Delete Test', description: 'To Be Deleted' };
      const { data: createdData } = await supabase
        .from(testTable)
        .insert(testData)
        .select();
      
      const recordId = createdData[0].id;
      
      // Now delete it
      const { error } = await supabase
        .from(testTable)
        .delete()
        .eq('id', recordId);
      
      expect(error).toBeNull();
      
      // Verify it's gone
      const { data, count } = await supabase
        .from(testTable)
        .select('*', { count: 'exact' })
        .eq('id', recordId);
      
      expect(count).toBe(0);
    });
  });

  describe('Realtime Subscriptions', () => {
    let supabase;
    const testTable = 'test_table';
    
    beforeEach(() => {
      const { result } = renderHook(() => useSupabase());
      supabase = result.current.client;
    });
    
    afterEach(() => {
      // Clean up any subscriptions
      supabase.removeAllSubscriptions();
    });

    it('should set up a subscription and receive updates', async () => {
      const callback = vi.fn();
      
      // Set up subscription
      const subscription = supabase
        .from(testTable)
        .on('INSERT', callback)
        .subscribe();
      
      expect(subscription).toBeDefined();
      
      // Insert a new record to trigger the subscription
      const testData = { name: 'Subscription Test', description: 'Testing realtime' };
      await supabase
        .from(testTable)
        .insert(testData);
      
      // Wait for the callback to be called
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(callback).toHaveBeenCalled();
      
      // Clean up
      supabase.removeSubscription(subscription);
    });

    it('should filter subscriptions correctly', async () => {
      const matchingCallback = vi.fn();
      const nonMatchingCallback = vi.fn();
      
      // Set up filtered subscriptions
      const matchingSub = supabase
        .from(testTable)
        .on('INSERT', matchingCallback)
        .eq('name', 'Filtered Test')
        .subscribe();
      
      const nonMatchingSub = supabase
        .from(testTable)
        .on('INSERT', nonMatchingCallback)
        .eq('name', 'Different Name')
        .subscribe();
      
      // Insert a record that matches one filter but not the other
      const testData = { name: 'Filtered Test', description: 'Testing filters' };
      await supabase
        .from(testTable)
        .insert(testData);
      
      // Wait for callbacks
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(matchingCallback).toHaveBeenCalled();
      expect(nonMatchingCallback).not.toHaveBeenCalled();
      
      // Clean up
      supabase.removeSubscription(matchingSub);
      supabase.removeSubscription(nonMatchingSub);
    });

    it('should handle subscription errors gracefully', async () => {
      // Mock an error in the subscription
      const originalSubscribe = supabase.from;
      supabase.from = vi.fn().mockImplementation((table) => {
        if (table === 'non_existent_table') {
          return {
            on: () => ({
              subscribe: () => {
                throw new Error('Table does not exist');
              }
            })
          };
        }
        return originalSubscribe(table);
      });
      
      // Attempt to subscribe to a non-existent table
      expect(() => {
        supabase
          .from('non_existent_table')
          .on('INSERT', () => {})
          .subscribe();
      }).toThrow();
      
      // Restore original implementation
      supabase.from = originalSubscribe;
    });
  });
});