import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { 
  FaUserPlus, 
  FaUserCheck, 
  FaSearch, 
  FaHeart, 
  FaRegHeart,
  FaComment, 
  FaExternalLinkAlt,
  FaBook,
  FaVideo,
  FaRegClock,
  FaLink,
  FaEllipsisH,
  FaBookmark,
  FaRegBookmark,
  FaShare
} from 'react-icons/fa';
import { fetchUserProfile, followUser, unfollowUser } from '../store/slices/userSlice';
import { fetchUserContent } from '../store/slices/contentSlice';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './ProfilePage.css';

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else if (diffInHours < 168) { // 7 days
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

const ContentItem = ({ item }) => {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likes || 0);
  const navigate = useNavigate();
  
  const handleLike = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLiked(!isLiked);
    setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
  };
  
  const handleBookmark = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
  };
  
  const handleItemClick = () => {
    navigate(`/content/${item._id}`);
  };
  
  return (
    <div className="content-item" onClick={handleItemClick}>
      <div className="content-item-header">
        <div className="content-meta">
          <span className={`content-type ${item.type}`}>
            {item.type === 'article' ? <FaBook /> : <FaVideo />}
            {item.type}
          </span>
          <span className="post-time">
            <FaRegClock /> {formatDate(item.createdAt)}
          </span>
        </div>
        <button className="more-options">
          <FaEllipsisH />
        </button>
      </div>
      
      <h3 className="content-title">{item.title}</h3>
      
      <p className="content-summary">
        {item.summary?.length > 200 
          ? `${item.summary.substring(0, 200)}...` 
          : item.summary}
      </p>
      
      {item.originalUrl && (
        <a 
          href={item.originalUrl} 
          className="original-link"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <FaLink /> View original
        </a>
      )}
      
      <div className="content-actions">
        <button 
          className={`action-btn ${isLiked ? 'liked' : ''}`}
          onClick={handleLike}
        >
          {isLiked ? <FaHeart /> : <FaRegHeart />} {likeCount || ''}
        </button>
        <button className="action-btn">
          <FaComment />
        </button>
        <button className="action-btn">
          <FaShare />
        </button>
        <button 
          className={`action-btn bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
          onClick={handleBookmark}
        >
          {isBookmarked ? <FaBookmark /> : <FaRegBookmark />}
        </button>
      </div>
    </div>
  );
};

const ProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { user: currentUser } = useSelector((state) => state.auth);
  const { profile, loading: profileLoading, error: profileError } = useSelector((state) => state.user.currentProfile || {});
  const { items: content, loading: contentLoading, error: contentError, hasMore, currentPage } = useSelector(
    (state) => state.content.userContent || { items: [], loading: false, error: null, hasMore: false, currentPage: 1 }
  );
  
  const [activeTab, setActiveTab] = useState('summaries');
  const isOwner = currentUser && currentUser._id === profile?._id;

  // Fetch profile data
  useEffect(() => {
    if (userId) {
      dispatch(fetchUserProfile(userId));
    }
  }, [dispatch, userId]);

  // Fetch user content
  useEffect(() => {
    if (userId) {
      dispatch(fetchUserContent({ userId, page: 1 }));
    }
  }, [dispatch, userId]);

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      const isCurrentlyFollowing = profile?.isFollowing;
      
      if (isCurrentlyFollowing) {
        await dispatch(unfollowUser(profile._id)).unwrap();
        toast.success(`Unfollowed ${profile.username}`);
      } else {
        await dispatch(followUser(profile._id)).unwrap();
        toast.success(`Following ${profile.username}`);
      }
      
      // Refresh profile data
      dispatch(fetchUserProfile(userId));
    } catch (error) {
      console.error('Error updating follow status:', error);
      toast.error(error.message || 'Failed to update follow status');
    }
  };

  // Load more content
  const loadMoreContent = useCallback(() => {
    if (hasMore && !contentLoading) {
      dispatch(fetchUserContent({ userId, page: currentPage + 1 }));
    }
  }, [dispatch, userId, hasMore, contentLoading, currentPage]);

  // Loading state
  if (profileLoading) {
    return (
      <div className="profile-loading">
        <LoadingSpinner size="xl" />
        <p>Loading profile...</p>
      </div>
    );
  }

  // Error state
  if (profileError) {
    return (
      <div className="profile-error">
        <div className="error-message">
          {profileError.message || 'Failed to load profile'}
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="retry-button"
        >
          Retry
        </button>
      </div>
    );
  }

  // Profile not found
  if (!profile) {
    return (
      <div className="profile-not-found">
        <h2>User not found</h2>
        <p>The user you're looking for doesn't exist or has been deactivated.</p>
        <Link to="/discover" className="discover-button">
          Discover Users
        </Link>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="profile-avatar">
          {profile.profilePictureUrl ? (
            <img 
              src={profile.profilePictureUrl} 
              alt={profile.username} 
              className="avatar-image"
            />
          ) : (
            <div className="avatar-placeholder">
              {profile.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="profile-info">
          <div className="profile-actions">
            <h1 className="profile-username">@{profile.username}</h1>
            
            {!isOwner && (
              <div className="action-buttons">
                <button 
                  className={`follow-button ${profile.isFollowing ? 'following' : ''}`}
                  onClick={handleFollow}
                >
                  {profile.isFollowing ? (
                    <>
                      <FaUserCheck /> Following
                    </>
                  ) : (
                    <>
                      <FaUserPlus /> Follow
                    </>
                  )}
                </button>
                <button className="message-button">
                  Message
                </button>
              </div>
            )}
          </div>
          
          <div className="profile-stats">
            <div className="stat">
              <strong>{profile.postsCount || 0}</strong>
              <span>Posts</span>
            </div>
            <div className="stat">
              <strong>{profile.followersCount || 0}</strong>
              <span>Followers</span>
            </div>
            <div className="stat">
              <strong>{profile.followingCount || 0}</strong>
              <span>Following</span>
            </div>
          </div>
          
          <div className="profile-details">
            <h2 className="profile-name">{profile.fullName || profile.username}</h2>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
            {profile.website && (
              <a 
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                className="profile-website"
                target="_blank"
                rel="noopener noreferrer"
              >
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>
      </div>
      
      {/* Profile Tabs */}
      <div className="profile-tabs">
        <div className="tabs-container">
          <button 
            className={`tab ${activeTab === 'summaries' ? 'active' : ''}`}
            onClick={() => setActiveTab('summaries')}
          >
            <FaBook /> Summaries
          </button>
          <button 
            className={`tab ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => setActiveTab('saved')}
          >
            <FaBookmark /> Saved
          </button>
          {isOwner && (
            <button 
              className={`tab ${activeTab === 'drafts' ? 'active' : ''}`}
              onClick={() => setActiveTab('drafts')}
            >
              Drafts
            </button>
          )}
        </div>
      </div>
      
      {/* Profile Content */}
      <div className="profile-content">
        {activeTab === 'summaries' && (
          <div className="content-feed">
            {contentLoading && content.length === 0 ? (
              <div className="loading-content">
                <LoadingSpinner size="lg" />
                <p>Loading content...</p>
              </div>
            ) : contentError ? (
              <div className="error-content">
                <p>Failed to load content: {contentError.message}</p>
                <button 
                  onClick={() => dispatch(fetchUserContent({ userId, page: 1 }))}
                  className="retry-button"
                >
                  Retry
                </button>
              </div>
            ) : content.length === 0 ? (
              <div className="empty-content">
                <h3>No content yet</h3>
                <p>When {isOwner ? 'you create' : 'they create'} content, it will appear here.</p>
                {isOwner && (
                  <Link to="/add" className="create-button">
                    Create Your First Summary
                  </Link>
                )}
              </div>
            ) : (
              <>
                <div className="content-list">
                  {content.map((item) => (
                    <ContentItem 
                      key={item._id} 
                      item={item} 
                    />
                  ))}
                </div>
                
                {hasMore && (
                  <div className="load-more">
                    <button 
                      onClick={loadMoreContent}
                      disabled={contentLoading}
                      className="load-more-button"
                    >
                      {contentLoading ? 'Loading...' : 'Load More'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        {activeTab === 'saved' && (
          <div className="saved-content">
            <div className="empty-state">
              <FaBookmark size={48} className="empty-icon" />
              <h3>No saved items yet</h3>
              <p>Save summaries to view them later</p>
              <Link to="/discover" className="discover-button">
                Discover Summaries
              </Link>
            </div>
          </div>
        )}
        
        {activeTab === 'drafts' && (
          <div className="drafts-content">
            <div className="empty-state">
              <FaBook size={48} className="empty-icon" />
              <h3>No drafts yet</h3>
              <p>Your drafts will appear here</p>
              <Link to="/add" className="create-button">
                Create New Summary
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
