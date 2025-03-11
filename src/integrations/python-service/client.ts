/**
 * Python Microservice API Client
 * 
 * This client provides methods to interact with the Python microservice
 * that handles Inmeta API integration and Supabase data processing.
 */

import axios from 'axios';

// Get the API URL from environment variables or use a default for development
const API_URL = import.meta.env.VITE_PYTHON_SERVICE_URL || 'http://localhost:8000';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
});

// Add request interceptor for authentication if needed
apiClient.interceptors.request.use(
  (config) => {
    // You can add auth token here if needed
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle specific error codes
    if (error.response) {
      // Server responded with a status code outside of 2xx range
      console.error('API Error:', error.response.data);
    } else if (error.request) {
      // Request was made but no response was received
      console.error('Network Error:', error.request);
    } else {
      // Something happened in setting up the request
      console.error('Request Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const pythonServiceApi = {
  // Health check
  health: () => apiClient.get('/health'),
  
  // Events endpoints
  events: {
    getAccessEvents: (params: {
      start_date: string;
      end_date: string;
      project_id: string;
    }) => apiClient.post('/events/access', params),
  },
  
  // Projects endpoints
  projects: {
    list: (params?: {
      skip?: number;
      limit?: number;
      search?: string;
      status?: string;
      client?: string;
      force_refresh?: boolean;
    }) => apiClient.get('/projects', { params }),
    
    getById: (projectId: string, forceRefresh: boolean = false) => 
      apiClient.get(`/projects/${projectId}`, { 
        params: { force_refresh: forceRefresh } 
      }),
      
    getEvents: (projectId: string, params?: {
      start_date?: string;
      end_date?: string;
    }) => apiClient.get(`/projects/${projectId}/events`, { params }),
  },
};

export default pythonServiceApi;