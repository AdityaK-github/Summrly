import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { 
  FaSearch, 
  FaUserPlus, 
  FaUserCheck, 
  FaTimes, 
  FaSpinner, 
  FaBook, 
  FaVideo,
  FaExternalLinkAlt,
  FaExclamationCircle,
  FaUserFriends
} from 'react-icons/fa';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import { fetchDiscoverContent, searchUsers } from '../store/slices/discoverSlice';
import { followUser, unfollowUser } from '../store/slices/userSlice';
import './DiscoverPage.css';

const DiscoverPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('trending');
  const [page, setPage] = useState(1);
  const [localUsers, setLocalUsers] = useState([]);
  const [error, setError] = useState(null);
  
  const { 
    content, 
    loading, 
    hasMoreContent,
    contentLoading,
    userSearchLoading,
    users: reduxUsers
  } = useSelector((state) => state.discover);
  
  const { user: currentUser } = useSelector((state) => state.auth);
  const { followStatus } = useSelector((state) => state.user);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query) => {
      if (query.trim()) {
        dispatch(searchUsers({ query, page: 1 }));
        setPage(1);
      } else {
        setLocalUsers([]);
      }
    }, 500),
    [dispatch]
  );

  // Handle search input change
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (activeTab === 'users') {
      debouncedSearch(query);
    }
  };

  // Sync local users with Redux store
  useEffect(() => {
    if (activeTab === 'users' && searchQuery.trim()) {
      setLocalUsers(reduxUsers);
    }
  }, [reduxUsers, activeTab, searchQuery]);

  // Load more content
  const loadMore = () => {
    if (activeTab === 'trending') {
      const nextPage = page + 1;
      dispatch(fetchDiscoverContent({ page: nextPage }));
      setPage(nextPage);
    } else if (activeTab === 'users' && searchQuery.trim()) {
      const nextPage = page + 1;
      dispatch(searchUsers({ query: searchQuery, page: nextPage }));
      setPage(nextPage);
    }
  };

  // Initial load
  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        if (activeTab === 'trending') {
          await dispatch(fetchDiscoverContent({ page: 1 }));
        } else {
          setLocalUsers([]);
          setSearchQuery('');
        }
        if (isMounted) {
          setPage(1);
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load data. Please try again.');
      }
    };

    loadData();

    return () => {
      isMounted = false; // Cleanup to prevent state updates on unmounted component
    };
  }, [dispatch, activeTab]);

  // Handle follow/unfollow
  const handleFollowToggle = async (userId) => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      const isFollowing = followStatus[userId];
      
      if (isFollowing) {
        await dispatch(unfollowUser(userId));
      } else {
        await dispatch(followUser(userId));
      }

      // Update local users state
      setLocalUsers(prevUsers =>
        prevUsers.map(user =>
          user._id === userId
            ? {
                ...user,
                followersCount: isFollowing
                  ? user.followersCount - 1
                  : user.followersCount + 1,
              }
            : user
        )
      );

      toast.success(
        isFollowing ? 'Unfollowed successfully' : 'Followed successfully'
      );
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast.error('Failed to update follow status');
    }
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setLocalUsers([]);
    setPage(1);
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchQuery('');
    setLocalUsers([]);
  };

  // Render loading state
  const renderLoader = () => (
    <div className="loading" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      width: '100%'
    }}>
      <FaSpinner className="spinner" style={{
        animation: 'spin 1s linear infinite',
        fontSize: '2rem',
        marginBottom: '1rem'
      }} />
      <p>Loading content...</p>
    </div>
  );
  
  // Add CSS for spinner animation
  const spinnerStyle = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  // Render error state
  const renderError = () => (
    <div className="error-message">
      <FaExclamationCircle /> {error}
    </div>
  );

  // Render user card
  const renderUserCard = (user) => (
    <div key={user._id} className="user-card">
      <Link to={`/user/${user.username}`} className="user-link">
        <div className="user-avatar">
          {user.profilePictureUrl ? (
            <img src={user.profilePictureUrl} alt={user.username} />
          ) : (
            <div className="avatar-placeholder">
              {user.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="user-info">
          <h3>@{user.username}</h3>
          {user.name && <p className="user-name">{user.name}</p>}
          <p className="user-stats">
            {user.followersCount} followers • {user.followingCount} following
          </p>
        </div>
      </Link>
      {currentUser && currentUser._id !== user._id && (
        <button
          className={`follow-btn ${followStatus[user._id] ? 'following' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            handleFollowToggle(user._id);
          }}
        >
          {followStatus[user._id] ? (
            <>
              <FaUserCheck /> Following
            </>
          ) : (
            <>
              <FaUserPlus /> Follow
            </>
          )}
        </button>
      )}
    </div>
  );

  // Render content card
  const renderContentCard = (item) => (
    <div key={item._id} className="content-card">
      <div className="content-type">
        {item.type === 'article' ? <FaBook /> : <FaVideo />}
        <span>{item.type}</span>
      </div>
      <h3>
        <a
          href={item.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.title}
          <FaExternalLinkAlt className="external-icon" />
        </a>
      </h3>
      <p className="content-summary">
        {item.summary || 'No summary available'}
      </p>
      <div className="content-footer">
        <Link to={`/user/${item.user?.username}`} className="content-user">
          @{item.user?.username}
        </Link>
        <div className="content-meta">
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
          {item.tags && item.tags.length > 0 && (
            <div className="content-tags">
              {item.tags.slice(0, 2).map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
              {item.tags.length > 2 && (
                <span className="more-tags">+{item.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Show loading state on initial load
  if (loading && !content.length && !localUsers.length) {
    return renderLoader();
  }

  return (
    <div className="discover-page">
      <style>{spinnerStyle}</style>
      <div className="discover-header">
        <h1>Discover</h1>
        <p>Find interesting content and connect with other users</p>
      </div>

      <div className="search-container">
        <div className="search-input-container">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
          {searchQuery && (
            <button onClick={handleClearSearch} className="clear-search">
              <FaTimes />
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'trending' ? 'active' : ''}`}
          onClick={() => handleTabChange('trending')}
        >
          Trending Content
        </button>
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => handleTabChange('users')}
        >
          Search Users
        </button>
      </div>

      <div className="discover-content">
        {loading ? (
          renderLoader()
        ) : error ? (
          renderError()
        ) : activeTab === 'users' ? (
          <div className="users-grid">
            {localUsers.length > 0 ? (
              localUsers.map(renderUserCard)
            ) : searchQuery ? (
              <div className="empty-state">
                <FaSearch className="empty-icon" />
                <h3>No users found</h3>
                <p>Try a different search term</p>
              </div>
            ) : (
              <div className="empty-state">
                <FaUserFriends className="empty-icon" />
                <h3>Search for users</h3>
                <p>Enter a username or name to find users</p>
              </div>
            )}
          </div>
        ) : (
          <div className="content-grid">
            {content.length > 0 ? (
              content.map(renderContentCard)
            ) : (
              <div className="empty-state">
                <FaSearch className="empty-icon" />
                <h3>No trending content</h3>
                <p>Check back later for new content</p>
              </div>
            )}
          </div>
        )}
      </div>

      {(activeTab === 'trending' && hasMoreContent) && (
        <div className="load-more">
          <button 
            onClick={loadMore} 
            disabled={contentLoading}
          >
            {contentLoading ? (
              <>
                <FaSpinner className="spinner" /> Loading...
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default DiscoverPage;
