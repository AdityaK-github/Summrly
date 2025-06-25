import axios from 'axios';

// Create an axios instance with default config
const api = axios.create({
  baseURL: import.meta.env.MODE === 'development' ? 'http://localhost:5003/api' : (import.meta.env.VITE_API_URL || 'http://localhost:5003/api'),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Important for cookies if using them
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('summrly_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors (401, 403, 500, etc.)
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Handle unauthorized
          console.error('Unauthorized access - please log in');
          // You might want to redirect to login here
          break;
        case 403:
          // Handle forbidden
          console.error('You do not have permission to access this resource');
          break;
        case 404:
          console.error('The requested resource was not found');
          break;
        case 500:
          console.error('Server error - please try again later');
          break;
        default:
          console.error('An error occurred');
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response from server - please check your connection');
    } else {
      // Something happened in setting up the request
      console.error('Request error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
