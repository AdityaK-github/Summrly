import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const TOKEN_KEY = 'summrly_token';
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setTokenState] = useState(localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const API_BASE_URL = 'http://localhost:5003/api';

  // Set token in both state and local storage
  const setToken = useCallback((newToken) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  // Fetch user profile using the current token
  const fetchUserProfile = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    
    if (!currentToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies if using httpOnly cookies
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }
      
      const data = await response.json();
      setUser(data);
      setToken(currentToken); // Ensure token is in state
      return data;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError(err.message || 'Failed to load user profile');
      // Don't clear token here - let the component decide what to do
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE_URL, setToken]);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const currentToken = localStorage.getItem(TOKEN_KEY);
      if (currentToken) {
        await fetchUserProfile();
      } else {
        setIsLoading(false);
      }
    };
    
    initAuth();
    
    // Set up a timer to refresh the token before it expires
    const refreshInterval = setInterval(() => {
      const currentToken = localStorage.getItem(TOKEN_KEY);
      if (currentToken) {
        // Refresh token logic can be added here if needed
        console.log('Token refresh check');
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
    
    return () => clearInterval(refreshInterval);
  }, [fetchUserProfile]);

  // Login function that sets the token and fetches user profile
  const login = useCallback(async (newToken) => {
    setToken(newToken);
    const userData = await fetchUserProfile();
    return { success: !!userData, user: userData };
  }, [fetchUserProfile, setToken]);

  // Logout function that clears auth state
  const logout = useCallback(() => {
    // Call the backend logout endpoint if needed
    fetch(`${API_BASE_URL}/users/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(console.error);
    
    // Clear local state
    setToken(null);
    setUser(null);
    setError(null);
    
    // Navigate to login page
    navigate('/login');
  }, [navigate, setToken]);

  // Create an axios instance with auth headers
  const authAxios = useCallback((options = {}) => {
    const currentToken = token || localStorage.getItem(TOKEN_KEY);
    
    return fetch(options.url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': currentToken ? `Bearer ${currentToken}` : '',
        ...options.headers,
      },
      credentials: 'include',
    }).then(async (response) => {
      if (response.status === 401) {
        // Token expired or invalid
        logout();
        throw new Error('Session expired. Please log in again.');
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }
      
      return data;
    });
  }, [token, logout]);

  return (
    <AuthContext.Provider 
      value={{ 
        token,
        user,
        isLoading,
        error,
        login,
        logout,
        fetchUserProfile,
        authAxios,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
