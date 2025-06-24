import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loadUser } from './store/slices/authSlice';
import Navbar from './components/Navbar';
import LoadingSpinner from './components/common/LoadingSpinner';

// Lazy load page components
const HomePage = lazy(() => import('./pages/HomePage'));
const MyListPage = lazy(() => import('./pages/MyListPage'));
const AddNewPage = lazy(() => import('./pages/AddNewPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const AuthSuccessPage = lazy(() => import('./pages/AuthSuccessPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const ContentDetailPage = lazy(() => import('./pages/ContentDetailPage'));

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" />
  </div>
);
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
  const [initialLoadAttempted, setInitialLoadAttempted] = useState(false);
  
  // Use separate selectors for each piece of state to prevent unnecessary re-renders
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isLoading = useSelector((state) => state.auth.isLoading);
  const token = useSelector((state) => state.auth.token);

  // Load user on app start if token exists
  useEffect(() => {
    const storedToken = localStorage.getItem('summrly_token');
    
    const loadUserData = async () => {
      if (storedToken) {
        try {
          await dispatch(loadUser()).unwrap();
        } catch (err) {
          console.error('Failed to load user:', err);
          localStorage.removeItem('summrly_token');
        }
      }
      setInitialLoadAttempted(true);
    };

    loadUserData();
  }, [dispatch]);

  // Show loading spinner during initial auth check
  if ((isLoading && token) || !initialLoadAttempted) {
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
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/content/:id" element={
              <ProtectedRoute>
                <ContentDetailPage />
              </ProtectedRoute>
            } />
            <Route path="/profile/:userId" element={<ProfilePage />} />
            <Route path="/profile/:userId/followers" element={<div>Followers</div>} />
            <Route path="/profile/:userId/following" element={<div>Following</div>} />
            
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
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/success" element={<AuthSuccessPage />} />
            <Route 
              path="/users" 
              element={
                <ProtectedRoute>
                  <UsersPage />
                </ProtectedRoute>
              } 
            />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
}

export default App;
