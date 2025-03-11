// Jest setup file
import '@testing-library/jest-dom';

// Mock the environment variables
vi.mock('import.meta', () => ({
  env: {
    VITE_PYTHON_SERVICE_URL: 'http://localhost:8000',
    VITE_SUPABASE_URL: 'https://example.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key'
  }
}));

// Mock console methods to keep test output clean
// Comment these out if you need to debug tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
  console.log = originalConsoleLog;
});

// Global test timeout
jest.setTimeout(10000);