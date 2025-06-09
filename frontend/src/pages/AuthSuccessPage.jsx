import React, { useEffect, useContext, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaSpinner } from 'react-icons/fa';
import AuthContext from '../AuthContext';
import './AuthSuccessPage.css';

const AuthSuccessPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const state = params.get('state');
    const storedState = localStorage.getItem('oauth_state');
    
    // Clear the stored state to prevent replay attacks
    localStorage.removeItem('oauth_state');

    const handleAuthError = (errorMessage, errorCode = 'auth_failed') => {
      console.error(errorMessage);
      setError(errorMessage);
      setIsLoading(false);
      // Redirect to login page with error after a short delay
      setTimeout(() => {
        navigate(`/login?error=${errorCode}`);
      }, 3000);
    };

    // Validate state parameter to prevent CSRF
    if (!state || state !== storedState) {
      return handleAuthError('Invalid authentication state. Please try again.', 'invalid_state');
    }

    if (!token) {
      return handleAuthError('Authentication failed. No token received.', 'no_token');
    }

    // Process the successful authentication
    const processLogin = async () => {
      try {
        setIsLoading(true);
        await login(token);
        // Redirect to the previous page or home after successful login
        const from = location.state?.from?.pathname || '/';
        navigate(from);
      } catch (err) {
        handleAuthError('Failed to complete login. Please try again.', 'login_failed');
      } finally {
        setIsLoading(false);
      }
    };

    processLogin();
  }, [location, navigate, login]);

  if (isLoading) {
    return (
      <div className="auth-success-container">
        <div className="auth-loading">
          <FaSpinner className="spinner" />
          <h2>Completing Authentication...</h2>
          <p>Please wait while we log you in.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auth-error">
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <p>Redirecting to login page...</p>
      </div>
    );
  }

  return null; // Shouldn't reach here due to redirects
};

export default AuthSuccessPage;
