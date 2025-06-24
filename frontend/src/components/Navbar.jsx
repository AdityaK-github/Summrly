import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  FaHome, 
  FaPlus, 
  FaList, 
  FaCompass, 
  FaUser, 
  FaUsers,
  FaSignOutAlt, 
  FaCog, 
  FaChevronDown,
  FaSpinner
} from 'react-icons/fa';
import { logout } from '../store/slices/authSlice';
import './Navbar.css';

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  
  // Use separate selectors for each piece of state to prevent unnecessary re-renders
  const user = useSelector((state) => state.auth.user);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const isLoading = useSelector((state) => state.auth.isLoading);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Add scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isActive = (path) => {
    return location.pathname === path || 
           (path !== '/' && location.pathname.startsWith(path));
  };

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const getUserInitials = () => {
    if (user?.username) return user.username.charAt(0).toUpperCase();
    if (user?.name) {
      const names = user.name.split(' ');
      return names.length > 1 
        ? `${names[0].charAt(0)}${names[1].charAt(0)}`.toUpperCase()
        : names[0].charAt(0).toUpperCase();
    }
    return <FaUser />;
  };

  return (
    <nav className={`navbar ${isScrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/" className="navbar-logo">
            <span className="logo-text">Summrly</span>
            <span className="logo-dot">.</span>
          </Link>
        </div>
        
        <ul className="navbar-links">
          <li className={`nav-item ${isActive('/') ? 'active' : ''}`}>
            <Link to="/" className="nav-link">
              <FaHome className="nav-icon" />
              <span className="nav-text">Home</span>
            </Link>
          </li>
          
          {isLoading ? (
            <li className="nav-item loading">
              <div className="nav-link">
                <FaSpinner className="spinner" />
              </div>
            </li>
          ) : isAuthenticated ? (
            <>
              <li className={`nav-item ${isActive('/my-list') ? 'active' : ''}`}>
                <Link to="/my-list" className="nav-link">
                  <FaList className="nav-icon" />
                  <span className="nav-text">My List</span>
                </Link>
              </li>
              
              <li className={`nav-item ${isActive('/add') ? 'active' : ''}`}>
                <Link to="/add" className="nav-link add-new">
                  <FaPlus className="nav-icon" />
                  <span className="nav-text">Add New</span>
                </Link>
              </li>
              
              <li className={`nav-item ${isActive('/discover') ? 'active' : ''}`}>
                <Link to="/discover" className="nav-link">
                  <FaCompass className="nav-icon" />
                  <span className="nav-text">Discover</span>
                </Link>
              </li>
              
              <li className={`nav-item ${isActive('/users') ? 'active' : ''}`}>
                <Link to="/users" className="nav-link">
                  <FaUsers className="nav-icon" />
                  <span className="nav-text">Users</span>
                </Link>
              </li>
              
              <li className="nav-item user-menu" ref={menuRef}>
                <button 
                  className={`user-button ${isMenuOpen ? 'active' : ''}`}
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-haspopup="true"
                  aria-expanded={isMenuOpen}
                >
                  <div className="user-avatar">
                    {user?.profilePictureUrl ? (
                      <img 
                        src={user.profilePictureUrl} 
                        alt={user.username || 'Profile'} 
                        className="avatar-image"
                      />
                    ) : (
                      <div className="avatar-initials">
                        {getUserInitials()}
                      </div>
                    )}
                  </div>
                  <span className="username">
                    {user.username || (user.name ? user.name.split(' ')[0] : 'Profile')}
                  </span>
                  <FaChevronDown className={`dropdown-arrow ${isMenuOpen ? 'open' : ''}`} />
                </button>
                
                {isMenuOpen && (
                  <div className="dropdown-menu">
                    <Link 
                      to={`/user/${user.username || 'profile'}`} 
                      className="dropdown-item"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <FaUser className="dropdown-icon" />
                      <span>Profile</span>
                    </Link>
                    <Link 
                      to="/settings" 
                      className="dropdown-item"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <FaCog className="dropdown-icon" />
                      <span>Settings</span>
                    </Link>
                    <Link 
                      to="/users" 
                      className="dropdown-item"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <FaUsers className="dropdown-icon" />
                      <span>Users</span>
                    </Link>
                    <div className="dropdown-divider"></div>
                    <button 
                      className="dropdown-item logout"
                      onClick={handleLogout}
                    >
                      <FaSignOutAlt className="dropdown-icon" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </li>
            </>
          ) : (
            <li className={`nav-item ${isActive('/login') ? 'active' : ''}`}>
              <Link to="/login" className="nav-link login-button">
                <FaUser className="nav-icon" />
                <span className="nav-text">Login</span>
              </Link>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
