import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loadUser } from './store/slices/authSlice';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import MyListPage from './pages/MyListPage';
import AddNewPage from './pages/AddNewPage';
import LoginPage from './pages/LoginPage';
import AuthSuccessPage from './pages/AuthSuccessPage';
import DiscoverPage from './pages/DiscoverPage';
import ProfilePage from './pages/ProfilePage';
import LoadingSpinner from './components/common/LoadingSpinner';
import './App.css';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useSelector((state) => state.auth);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading } = useSelector((state) => state.auth);

  // Load user on app start if token exists
  useEffect(() => {
    if (localStorage.getItem('summrly_token')) {
      dispatch(loadUser());
    }
  }, [dispatch]);

  if (isLoading && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="App">
      <Navbar />
      <div className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/user/:username" element={<ProfilePage />} />
          <Route path="/user/:username/followers" element={<div>Followers</div>} />
          <Route path="/user/:username/following" element={<div>Following</div>} />
          
          {/* Protected Routes */}
          <Route
            path="/my-list"
            element={
              <ProtectedRoute>
                <MyListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add"
            element={
              <ProtectedRoute>
                <AddNewPage />
              </ProtectedRoute>
            }
          />
          
          {/* Auth Routes */}
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} 
          />
          <Route path="/auth/success" element={<AuthSuccessPage />} />
          
          {/* 404 Route */}
          <Route path="*" element={<div>404 - Page Not Found</div>} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
