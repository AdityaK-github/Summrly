import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaSpinner, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { login } from '../store/slices/authSlice';

const AuthSuccessPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(true);
  const { isLoading } = useSelector((state) => state.auth);

  useEffect(() => {
    const processAuth = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      const state = params.get('state');
      const storedState = localStorage.getItem('oauth_state');

      // Clear the stored state to prevent replay attacks
      localStorage.removeItem('oauth_state');

      try {
        // Validate state parameter to prevent CSRF
        if (!state || state !== storedState) {
          throw new Error('Invalid authentication state');
        }

        if (!token) {
          throw new Error('No authentication token received');
        }

        // Dispatch login action with the token
        const result = await dispatch(login({ token }));
        
        if (result.meta.requestStatus === 'fulfilled') {
          // Get the redirect path from URL parameters or localStorage
          const from = location.state?.from?.pathname || '/';
          
          // Small delay to show success message
          setTimeout(() => {
            navigate(from, { replace: true });
          }, 1000);
        } else {
          throw new Error('Authentication failed');
        }
      } catch (err) {
        console.error('Authentication error:', err);
        setError(err.message || 'Authentication failed. Please try again.');
        
        // Redirect to login page with error after a delay
        setTimeout(() => {
          navigate('/login', { 
            state: { error: error || 'Authentication failed' },
            replace: true 
          });
        }, 3000);
      } finally {
        setIsProcessing(false);
      }
    };

    processAuth();
  }, [location, dispatch, navigate, error]);

  if (isProcessing || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <FaSpinner className="animate-spin text-blue-500 text-4xl mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800">Completing Authentication</h2>
          <p className="text-gray-600 mt-2">Please wait while we log you in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <FaExclamationTriangle className="text-red-500 text-4xl mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800">Authentication Error</h2>
          <p className="text-gray-600 mt-2">{error}</p>
          <p className="text-sm text-gray-500 mt-4">Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  // Success state (briefly shown before redirect)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-md">
        <FaCheck className="text-green-500 text-4xl mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800">Login Successful!</h2>
        <p className="text-gray-600 mt-2">You are being redirected...</p>
      </div>
    </div>
  );
};

export default AuthSuccessPage;
