import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { 
  FaSearch, 
  FaUserPlus, 
  FaUserCheck, 
  FaTimes, 
  FaBook, 
  FaVideo,
  FaExternalLinkAlt,
  FaExclamationCircle,
  FaUserFriends,
  FaArrowRight
} from 'react-icons/fa';
import { debounce } from 'lodash';
import { toast } from 'react-toastify';
import { fetchDiscoverContent, searchUsers, clearUserSearch } from '../store/slices/discoverSlice';
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
    users: reduxUsers,
    userSearchPerformed,
    hasMoreUsers,
    error: discoverError
  } = useSelector((state) => state.discover);
  
  const { user: currentUser } = useSelector((state) => state.auth);
  const { followStatus = {} } = useSelector((state) => state.user) || {};

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query) => {
      if (query.trim()) {
        dispatch(searchUsers({ query, page: 1 }));
        setPage(1);
      } else {
        dispatch(clearUserSearch());
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
      if (query.trim()) {
        debouncedSearch(query);
      } else {
        dispatch(clearUserSearch());
        setLocalUsers([]);
      }
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

  // Handle content click
  const handleContentClick = useCallback((contentItem, e) => {
    if (!contentItem?._id) return;
    
    // Don't navigate if the click was on a button or link inside the card
    if (e && (e.target.tagName === 'BUTTON' || 
              e.target.closest('button') || 
              e.target.tagName === 'A' || 
              e.target.closest('a'))) {
      e.stopPropagation();
      return;
    }
    
    navigate(`/content/${contentItem._id}`);
  }, [navigate]);
  
  // Handle link clicks within content cards
  const handleLinkClick = useCallback((e) => {
    e.stopPropagation();
    // The link's default behavior will handle the navigation
  }, []);

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
    dispatch(clearUserSearch());
  };

  // Render loading state
  const renderLoader = (message = 'Loading...') => (
    <div className="loading-state">
      <div className="loading-spinner" />
      <p>{message}</p>
    </div>
  );
  

  // Render error state
  const renderError = (errorMessage = error) => (
    <div className="error-message">
      <FaExclamationCircle className="error-icon" />
      <span>{errorMessage}</span>
    </div>
  );
  
  // Render empty state
  const renderEmptyState = (icon, title, message) => (
    <div className="empty-state">
      <div className="empty-icon">
        {icon}
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );

  // Render user card
  const renderUserCard = (user) => {
    if (!user || !user._id || !user.username) {
      console.error('Invalid user data:', user);
      return null; // Skip rendering if user data is invalid
    }

    // Safely get the follow status with a default of false
    const isFollowing = followStatus && followStatus[user._id] === true;
    const showFollowButton = currentUser && currentUser._id !== user._id;

    return (
      <div key={user._id} className="user-card">
        <Link to={`/profile/${user.username}`} className="user-link">
          <div className="user-avatar">
            {user.profilePictureUrl ? (
              <img 
                src={user.profilePictureUrl} 
                alt={user.username} 
                onError={(e) => {
                  if (e.target) {
                    e.target.onerror = null;
                    if (e.target.parentElement) {
                      e.target.parentElement.innerHTML = user.username?.charAt(0)?.toUpperCase() || 'U';
                    }
                  }
                }}
              />
            ) : (
              <div className="avatar-placeholder">
                {user.username?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
          </div>
          <div className="user-info">
            <h3 className="user-username">@{user.username}</h3>
            {user.bio && <p className="user-bio">{user.bio}</p>}
            <div className="user-stats">
              <span className="user-stat">
                <strong>{user.followersCount || 0}</strong> followers
              </span>
              <span className="user-stat">
                <strong>{user.followingCount || 0}</strong> following
              </span>
            </div>
          </div>
        </Link>
        {showFollowButton && (
          <button
            className={`follow-button ${isFollowing ? 'following' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              handleFollowToggle(user._id);
            }}
            disabled={!currentUser}
            title={!currentUser ? 'Log in to follow users' : ''}
          >
            {isFollowing ? (
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
  };

  // Format date helper function
  const formatDate = useCallback((dateString) => {
    try {
      if (!dateString) return '';
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  }, []);

  // Render content card
  const renderContentCard = (item) => {
    if (!item || !item._id) {
      console.error('Invalid content item:', item);
      return null;
    }

    return (
      <div 
        key={item._id} 
        className="content-card group hover:shadow-lg transition-shadow duration-200"
        onClick={(e) => handleContentClick(item, e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleContentClick(item, e);
          }
        }}
        aria-label={`View details for ${item.title || 'content item'}`}
      >
        <div className="content-card-header">
          <div className="content-type">
            {item.type === 'article' ? (
              <FaBook className="text-blue-600" />
            ) : (
              <FaVideo className="text-red-600" />
            )}
            <span className="ml-1">
              {item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : 'Content'}
            </span>
          </div>
          <Link 
            to={`/profile/${item.user?.username || 'unknown'}`}
            className="content-user hover:text-blue-600 transition-colors"
            onClick={handleLinkClick}
            aria-label={`View ${item.user?.username || 'user'}'s profile`}
          >
            @{item.user?.username || 'unknown'}
          </Link>
        </div>
        <div className="content-card-body">
          <h3 className="content-title">
            <a
              href={item.originalUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="content-link"
              onClick={handleLinkClick}
            >
              {item.title || 'Untitled'}
              <FaExternalLinkAlt className="external-icon" />
            </a>
          </h3>
          <p className="content-summary">
            {item.summary || 'No summary available'}
          </p>
        </div>
        <div className="content-card-footer">
          <div className="content-meta">
            <span className="content-date">{formatDate(item.createdAt)}</span>
            {item.tags?.length > 0 && (
              <div className="content-tags">
                {item.tags.slice(0, 2).map((tag, index) => (
                  <span key={`${tag}-${index}`} className="tag">
                    {tag}
                  </span>
                ))}
                {item.tags.length > 2 && (
                  <span className="more-tags">+{item.tags.length - 2}</span>
                )}
              </div>
            )}
          </div>
          <button 
            className="view-more"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/content/${item._id}`);
            }}
          >
            View <FaArrowRight className="view-more-icon" />
          </button>
        </div>
      </div>
    );
  };

  // Show loading state on initial load
  if (loading && !content.length && !localUsers.length) {
    return (
      <div className="discover-container">
        {renderLoader('Loading discover content...')}
      </div>
    );
  }

  return (
    <div className="discover-container">
      <div className="discover-header">
        <h1>Discover</h1>
        <p>Find interesting content and connect with other users</p>
      </div>

      <div className="search-container">
        <div className="search-input-wrapper">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder={`Search ${activeTab === 'users' ? 'users by username...' : 'content...'}`}
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
            aria-label="Search"
          />
          {searchQuery && (
            <button 
              onClick={handleClearSearch} 
              className="clear-search"
              aria-label="Clear search"
            >
              <FaTimes />
            </button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'trending' ? 'active' : ''}`}
          onClick={() => handleTabChange('trending')}
          aria-pressed={activeTab === 'trending'}
        >
          <FaBook />
          <span>Trending Content</span>
        </button>
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => handleTabChange('users')}
          aria-pressed={activeTab === 'users'}
        >
          <FaUserFriends />
          <span>Search Users</span>
        </button>
      </div>

      <div className="discover-content">
        {discoverError ? (
          renderError(discoverError)
        ) : activeTab === 'users' ? (
          <>
            <div className="users-grid">
              {userSearchLoading && page === 1 ? (
                renderLoader('Searching users...')
              ) : localUsers.length > 0 ? (
                localUsers.map(renderUserCard)
              ) : userSearchPerformed ? (
                renderEmptyState(
                  <FaSearch className="empty-icon" />,
                  'No users found',
                  'Try a different search term'
                )
              ) : (
                renderEmptyState(
                  <FaUserFriends className="empty-icon" />,
                  'Search for users',
                  'Enter a username to find other users'
                )
              )}
            </div>
            {userSearchLoading && page > 1 && renderLoader('Loading more users...')}
          </>
        ) : (
          <>
            <div className="content-grid">
              {contentLoading && page === 1 ? (
                renderLoader('Loading trending content...')
              ) : content.length > 0 ? (
                content.map(renderContentCard)
              ) : (
                renderEmptyState(
                  <FaSearch className="empty-icon" />,
                  'No trending content',
                  'Check back later for new content'
                )
              )}
            </div>
            {contentLoading && page > 1 && renderLoader('Loading more content...')}
          </>
        )}
      </div>

      {activeTab === 'trending' && hasMoreContent && !contentLoading && (
        <div className="load-more">
          <button 
            onClick={loadMore} 
            className="load-more-button"
            disabled={contentLoading}
          >
            Load More
          </button>
        </div>
      )}
      
      {activeTab === 'users' && hasMoreUsers && !userSearchLoading && localUsers.length > 0 && (
        <div className="load-more">
          <button 
            onClick={loadMore} 
            className="load-more-button"
            disabled={userSearchLoading}
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default DiscoverPage;
