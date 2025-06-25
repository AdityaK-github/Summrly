import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { FaGoogle, FaSpinner, FaExclamationCircle } from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../store/slices/authSlice';
import './LoginPage.css';

const LoginPage = () => {
  const [localLoading, setLocalLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isLoading = useSelector((state) => state.auth.isLoading);
  const error = useSelector((state) => state.auth.error);

  // Handle OAuth errors from URL parameters
  useEffect(() => {
    const errorCode = searchParams.get('error');
    
    if (errorCode) {
      // Clear URL parameters after reading them
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [searchParams]);

  // Handle successful authentication and redirect
  useEffect(() => {
    if (isAuthenticated) {
      // Get the redirect path from URL parameters or localStorage
      const from = searchParams.get('from') || 
                 localStorage.getItem('pre_auth_path') || 
                 '/';
      
      // Clean up stored path
      if (localStorage.getItem('pre_auth_path')) {
        localStorage.removeItem('pre_auth_path');
      }
      
      // Use setTimeout to ensure state updates are processed before navigation
      const timer = setTimeout(() => {
        navigate(from, { replace: true });
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, navigate, searchParams]);
  
  // Clear any errors when component unmounts
  useEffect(() => {
    return () => {
      if (error) {
        dispatch(clearError());
      }
    };
  }, [dispatch, error]);

  // Generate a secure random state parameter
  const generateState = useCallback(() => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }, []);

  const handleGoogleLogin = () => {
    setLocalLoading(true);
    
    try {
      // Generate a secure state parameter for CSRF protection
      const state = generateState();
      localStorage.setItem('oauth_state', state);
      
      // Store the current path to redirect back after login
      const redirectPath = window.location.pathname + window.location.search;
      localStorage.setItem('pre_auth_path', redirectPath);
      
      // Build the OAuth URL
      const apiUrl = import.meta.env.MODE === 'development' ? 'http://localhost:5003' : (import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5003');
      const oauthUrl = new URL(`${apiUrl}/api/users/auth/google`);
      oauthUrl.searchParams.append('state', state);
      
      // Redirect to the OAuth provider
      window.location.href = oauthUrl.toString();
    } catch (err) {
      console.error('Login error:', err);
      setLocalLoading(false);
    }
  };

  // Handle OAuth callback if token is in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const state = params.get('state');
    const storedState = localStorage.getItem('oauth_state');
    
    if (token && state && state === storedState) {
      // Clean up the URL
      const cleanPath = window.location.pathname;
      window.history.replaceState({}, document.title, cleanPath);
      localStorage.removeItem('oauth_state');
      
      // Process the login
      const processLogin = async () => {
        try {
          setLocalLoading(true);
          const result = await dispatch(login({ token }));
          
          // If login is successful, set a flag to indicate successful login
          if (result.meta.requestStatus === 'fulfilled') {
            localStorage.setItem('login_success', 'true');
          }
          
          if (result.error) {
            console.error('Login error:', result.error);
          }
        } catch (err) {
          console.error('Login error:', err);
        } finally {
          setLocalLoading(false);
        }
      };
      
      processLogin();
    }
  }, [location, dispatch]);

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>Welcome to Summrly</h1>
          <p className="subtitle">Sign in to save and organize your summaries</p>
        </div>
        
        {error && (
          <div className="error-message" role="alert" aria-live="assertive">
            <FaExclamationCircle className="error-icon" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        
        <div className="auth-methods">
          <button 
            className="google-login-button" 
            onClick={handleGoogleLogin}
            disabled={isLoading || localLoading}
            aria-label="Sign in with Google"
          >
            {(isLoading || localLoading) ? (
              <>
                <FaSpinner className="spinner" aria-hidden="true" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <FaGoogle className="google-icon" aria-hidden="true" />
                <span>Continue with Google</span>
              </>
            )}
          </button>
          
          <div className="divider">
            <span>or</span>
          </div>
          
          {/* Placeholder for email/password login if needed in the future */}
          <div className="email-login-note">
            <p>Email/password login coming soon!</p>
          </div>
        </div>
        
        <div className="login-footer">
          <p className="privacy-note">
            By signing in, you agree to our <a href="/terms" className="link">Terms of Service</a> and{' '}
            <a href="/privacy" className="link">Privacy Policy</a>
          </p>
          
          <div className="app-info">
            <p className="version">Summrly v1.0.0</p>
            <p className="copyright">{' 2023'} Summrly. All rights reserved.</p>
          </div>
        </div>
      </div>
      
      <div className="login-illustration">
        {/* Add illustration or decorative image here */}
        <div className="placeholder-illustration">
          <div className="placeholder-content">
            <h2>Organize Your Reading</h2>
            <p>Save, tag, and find your summaries easily</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
