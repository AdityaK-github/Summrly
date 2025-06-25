import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  FaBook, 
  FaVideo, 
  FaUser, 
  FaRegClock, 
  FaHeart,
  FaRegHeart,
  FaRegComment,
  FaBookmark,
  FaRegBookmark,
  FaShare,
  FaEllipsisH,
  FaExclamationTriangle,
  FaNewspaper,
  FaCompass,
  FaPlus,
  FaUsers
} from 'react-icons/fa';
import { loginSuccess, loadUser } from '../store/slices/authSlice';
import { 
  fetchFeed, 
  likeContent, 
  unlikeContent, 
  saveContent, 
  unsaveContent 
} from '../store/slices/contentSlice';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './HomePage.css';

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

const FeedItem = ({ item, showUserInfo = true }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  
  // Ensure we have all required fields with defaults
  const safeItem = {
    ...item,
    title: item.title || 'Untitled',
    summary: item.summary || '',
    type: item.type || 'article',
    createdAt: item.createdAt || new Date().toISOString(),
    likes: Array.isArray(item.likes) ? item.likes : [],
    likesCount: typeof item.likesCount === 'number' ? item.likesCount : (item.likes?.length || 0),
    userId: item.userId || { _id: 'unknown', username: 'Unknown User', profilePictureUrl: '/default-avatar.png' },
    _id: item._id || Math.random().toString(36).substr(2, 9) // Generate a random ID if none exists
  };
  
  const [isBookmarked, setIsBookmarked] = useState(safeItem.isBookmarked || false);
  const [isLiked, setIsLiked] = useState(
    user && safeItem.likes && safeItem.likes.some(like => like.userId === user._id)
  );
  const [likeCount, setLikeCount] = useState(safeItem.likesCount);
  
  // Check if current user is the author of this post
  const isOwned = user && safeItem.userId && (user._id === safeItem.userId._id || user._id === safeItem.userId);
  
  // Get user display info with fallbacks
  const userDisplayName = safeItem.userId?.username || 'Unknown User';
  const userAvatar = safeItem.userId?.profilePictureUrl || '/default-avatar.png';
  
  const handleLike = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (isLiked) {
        await dispatch(unlikeContent(safeItem._id)).unwrap();
        setLikeCount(prev => Math.max(0, prev - 1));
      } else {
        await dispatch(likeContent(safeItem._id)).unwrap();
        setLikeCount(prev => prev + 1);
      }
      setIsLiked(!isLiked);
    } catch (error) {
      console.error('Failed to update like:', error);
    }
  };
  
  const handleBookmark = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (isBookmarked) {
        await dispatch(unsaveContent(safeItem._id)).unwrap();
      } else {
        await dispatch(saveContent(safeItem._id)).unwrap();
      }
      setIsBookmarked(!isBookmarked);
    } catch (error) {
      console.error('Failed to update bookmark:', error);
    }
  };
  
  const handleShare = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const shareUrl = `${window.location.origin}/content/${safeItem._id}`;
    
    if (navigator.share) {
      navigator.share({
        title: safeItem.title,
        text: `Check out this ${safeItem.type} on Summrly`,
        url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    }
  };
  
  const navigateToContent = (e) => {
    if (e.target.closest('button, a, .action-button')) return;
    window.open(`/content/${safeItem._id}`, '_blank');
  };

  // User info is now handled at the component level with fallbacks
  
  
  return (
    <div className="feed-item" onClick={navigateToContent}>
      {showUserInfo && (
        <div className="feed-item-header">
          <div className="user-info">
            <Link 
              to={`/profile/${safeItem.userId?._id || ''}`} 
              onClick={e => e.stopPropagation()}
              className="user-link"
            >
              <img 
                src={userAvatar}
                alt={userDisplayName}
                className="avatar"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/default-avatar.png';
                }}
              />
              <div className="user-details">
                <h4>{userDisplayName}</h4>
                <span className="post-time" title={new Date(safeItem.createdAt).toLocaleString()}>
                  <FaRegClock /> {formatDate(safeItem.createdAt)}
                </span>
              </div>
            </Link>
          </div>
          
          {!isOwned && (
            <button 
              className="follow-button"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implement follow functionality
              }}
            >
              Follow
            </button>
          )}
          
          <button 
            className="more-options"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Implement more options menu
            }}
            aria-label="More options"
          >
            <FaEllipsisH />
          </button>
        </div>
      )}
      
      <div className="feed-item-content">
        <h3 className="feed-item-title">{safeItem.title}</h3>
        
        {safeItem.summary && (
          <div className="summary">
            <p>{safeItem.summary}</p>
          </div>
        )}
        
        {safeItem.thumbnailUrl && (
          <div className="thumbnail">
            <img 
              src={safeItem.thumbnailUrl} 
              alt={safeItem.title} 
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}
        
        {safeItem.originalUrl && (
          <div className="source-link">
            <a 
              href={safeItem.originalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
            >
              View original {safeItem.type}
            </a>
          </div>
        )}
      </div>
      
      <div className="feed-item-actions">
        <button 
          className={`action-button ${isLiked ? 'active' : ''}`}
          onClick={handleLike}
          aria-label={isLiked ? 'Unlike' : 'Like'}
        >
          {isLiked ? <FaHeart /> : <FaRegHeart />}
          <span>{likeCount}</span>
        </button>
        
        <button 
          className="action-button"
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Implement comment functionality
          }}
          aria-label="Comment"
        >
          <FaRegComment />
          <span>{safeItem.commentsCount || 0}</span>
        </button>
        
        <button 
          className="action-button"
          onClick={handleShare}
          aria-label="Share"
        >
          <FaShare />
        </button>
        
        <button 
          className={`action-button bookmark ${isBookmarked ? 'active' : ''}`}
          onClick={handleBookmark}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
        >
          {isBookmarked ? <FaBookmark /> : <FaRegBookmark />}
        </button>
      </div>
    </div>
  );
};

// Group feed items by user, keeping only the latest post per user
const getLatestPostsByUser = (items) => {
  if (!Array.isArray(items) || items.length === 0) return [];
  
  // Group items by user ID
  const userPostsMap = items.reduce((acc, item) => {
    // Handle both populated and non-populated user references
    const userId = item.userId?._id || item.userId || 'unknown';
    const userObj = typeof item.userId === 'object' ? item.userId : { _id: userId };
    
    // Create a normalized post object with all required fields
    const normalizedPost = {
      ...item,
      _id: item._id || Math.random().toString(36).substr(2, 9),
      userId: {
        _id: userObj._id || userId,
        username: userObj.username || 'Unknown User',
        profilePictureUrl: userObj.profilePictureUrl || '/default-avatar.png'
      },
      title: item.title || 'Untitled',
      summary: item.summary || '',
      type: item.type || 'article',
      likes: Array.isArray(item.likes) ? item.likes : [],
      likesCount: typeof item.likesCount === 'number' ? item.likesCount : (item.likes?.length || 0),
      commentsCount: typeof item.commentsCount === 'number' ? item.commentsCount : 0,
      isOwned: item.userId && (item.userId._id === (userObj._id || item.userId)),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString()
    };
    
    if (!acc[userId]) {
      acc[userId] = [];
    }
    acc[userId].push(normalizedPost);
    return acc;
  }, {});
  
  // Get the most recent post from each user and sort by creation date
  return Object.values(userPostsMap)
    .map(posts => 
      [...posts].sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      )[0]
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
};

const HomePage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const [feed, setFeed] = useState([]);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const isMounted = useRef(true);
  
  const currentUser = useSelector((state) => state.auth.user);
  const { loading } = useSelector((state) => state.content);

  // Render feed items with React.memo to prevent unnecessary re-renders
  const MemoizedFeedItem = React.memo(FeedItem, (prevProps, nextProps) => {
    // Only re-render if these specific props change
    return (
      prevProps.item._id === nextProps.item._id &&
      prevProps.item.likesCount === nextProps.item.likesCount &&
      prevProps.item.isBookmarked === nextProps.item.isBookmarked
    );
  });

  // Clear feed on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      setFeed([]);
      setPage(1);
      setHasMore(true);
    };
  }, []);

  // Handle OAuth redirect
  useEffect(() => {
    const handleOAuthToken = async (token) => {
      setIsProcessing(true);
      localStorage.setItem('summrly_token', token);
      
      try {
        await dispatch(loginSuccess({ user: null, token }));
        await dispatch(loadUser()).unwrap();
        
        // Clean up URL after successful login
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (error) {
        console.error('Failed to load user:', error);
        localStorage.removeItem('summrly_token');
        navigate('/login');
      } finally {
        setIsProcessing(false);
      }
    };
    
    const token = searchParams.get('token');
    if (token && !isAuthenticated && !isProcessing) {
      handleOAuthToken(token);
    }
  }, [searchParams, isAuthenticated, isProcessing, dispatch, navigate]);
  
  // Load feed data
  const loadFeed = useCallback(async (pageNum = 1, isRefresh = false) => {
    if (isLoading || !isMounted.current) return;
    if (!isRefresh && !hasMore) return;
    
    setIsLoading(true);
    
    try {
      const result = await dispatch(fetchFeed({ page: pageNum })).unwrap();
      const feedItems = Array.isArray(result) ? result : (result?.items || []);
      
      if (!Array.isArray(feedItems)) {
        throw new Error('Invalid feed data format');
      }
      
      const processedItems = feedItems.map(item => ({
        ...item,
        _id: item._id || Math.random().toString(36).substr(2, 9),
        userId: item.userId || { _id: 'unknown', username: 'Unknown User' },
        title: item.title || 'Untitled',
        summary: item.summary || '',
        type: item.type || 'article',
        likes: Array.isArray(item.likes) ? item.likes : [],
        likesCount: typeof item.likesCount === 'number' ? item.likesCount : (item.likes?.length || 0),
        isOwned: currentUser && item.userId && (currentUser._id === (item.userId._id || item.userId)),
        createdAt: item.createdAt || new Date().toISOString()
      }));
      
      if (!isMounted.current) return;
      
      // Group items by user and take only the latest from each user
      const latestPosts = getLatestPostsByUser(processedItems);
      
      setFeed(prevFeed => {
        if (isRefresh || pageNum === 1) {
          return latestPosts;
        }
        return [...prevFeed, ...latestPosts];
      });
      
      setHasMore(feedItems.length > 0);
      setPage(pageNum);
      
    } catch (err) {
      console.error('Failed to load feed:', err);
      setError('Failed to load feed. Please try again later.');
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [dispatch]);

  // Initial load
  useEffect(() => {
    isMounted.current = true;
    
    if (isAuthenticated && currentUser?._id) {
      loadFeed(1, true);
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [isAuthenticated, currentUser?._id]);
  
  // Handle pull to refresh
  const handleRefresh = () => {
    if (!isRefreshing) {
      setIsRefreshing(true);
      loadFeed(1, true);
    }
  };
  
  // Handle scroll to load more
  useEffect(() => {
    if (!isMounted.current || isLoading || !hasMore) return;
    
const throttle = (func, limit) => {
      let lastFunc;
      let lastRan;
      return function(...args) {
        if (!lastRan) {
          func.apply(this, args);
          lastRan = Date.now();
        } else {
          clearTimeout(lastFunc);
          lastFunc = setTimeout(() => {
            if ((Date.now() - lastRan) >= limit) {
              func.apply(this, args);
              lastRan = Date.now();
            }
          }, limit - (Date.now() - lastRan));
        }
      };
    };

    const handleScroll = throttle(() => {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      // Load more when user is 500px from the bottom
      if (scrollTop + clientHeight >= scrollHeight - 500 && hasMore && !isLoading) {
        loadFeed(page + 1);
      }
    }, 200);
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLoading, hasMore, page]);
  
  // Render loading state
  if ((loading && !feed?.length) || isProcessing) {
    return (
      <div className="feed-container">
        <div className="loading-container">
          <LoadingSpinner size="xl" />
          <p>Loading your feed...</p>
        </div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="feed-container">
        <div className="error-container">
          <div className="error-icon">
            <FaExclamationTriangle size={48} />
          </div>
          <h3>Something went wrong</h3>
          <p className="error-message">{error}</p>
          <button 
            onClick={handleRefresh}
            className="retry-button"
            disabled={loading}
          >
            {loading ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }
  
  // Render empty state
  if (!feed?.length) {
    return (
      <div className="feed-container">
        <div className="empty-feed">
          <div className="empty-icon">
            <FaNewspaper size={64} />
          </div>
          <h2>Your feed is empty</h2>
          <p>Follow some users to see their content here</p>
          <div className="empty-actions">
            <Link to="/discover" className="discover-button">
              <FaCompass /> Discover Users
            </Link>
            <Link to="/add" className="create-button">
              <FaPlus /> Create Your First Post
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  // Use the top-level getLatestPostsByUser function

  const latestPosts = getLatestPostsByUser(feed);

  // Render feed
  return (
    <div className="feed-container">
      <div className="feed-header">
        <h1>Latest from people you follow</h1>
        <button 
          onClick={handleRefresh}
          className="refresh-button"
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <>
              <span className="loading-spinner" style={{ marginRight: '8px' }} />
              Refreshing...
            </>
          ) : 'Refresh'}
        </button>
      </div>
      
      {latestPosts.length > 0 ? (
        <div className="feed-list">
          {latestPosts.map((item) => (
            <FeedItem 
              key={`${item.userId?._id || 'unknown'}-${item._id}`}
              item={item} 
              showUserInfo={true}
            />
          ))}
        </div>
      ) : (
        <div className="empty-feed">
          <div className="empty-icon">
            <FaUsers size={48} />
          </div>
          <h2>No recent activity</h2>
          <p>Follow more users to see their latest content here</p>
          <div className="empty-actions">
            <Link to="/discover" className="discover-button">
              <FaCompass /> Discover Users
            </Link>
          </div>
        </div>
      )}
      
      {loading && feed.length > 0 && (
        <div className="loading-more">
          <LoadingSpinner size="md" />
          <p>Loading more...</p>
        </div>
      )}
      
      {!hasMore && feed.length > 0 && (
        <div className="end-of-feed">
          <p>You've reached the end of your feed</p>
          <Link to="/discover" className="discover-more">
            Discover more content
          </Link>
        </div>
      )}
    </div>
  );
};

export default HomePage;
