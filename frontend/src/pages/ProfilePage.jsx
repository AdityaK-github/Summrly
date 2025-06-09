import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { FaUserPlus, FaUserCheck, FaSearch, FaHeart, FaComment, FaExternalLinkAlt } from 'react-icons/fa';
import axios from 'axios';
import './ProfilePage.css';

const ProfilePage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { user: currentUser } = useSelector((state) => state.auth);
  const [profile, setProfile] = useState(null);
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('summaries');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/api/feed/profile/${username}`);
        setProfile(data.user);
        setContent(data.content.items);
        setIsFollowing(data.user.isFollowing || false);
        setHasMore(data.content.pages > 1);
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    try {
      if (isFollowing) {
        await axios.post(`/api/discover/unfollow/${profile._id}`);
        toast.success(`Unfollowed ${profile.username}`);
      } else {
        await axios.post(`/api/discover/follow/${profile._id}`);
        toast.success(`Following ${profile.username}`);
      }
      setIsFollowing(!isFollowing);
      // Update followers count
      setProfile(prev => ({
        ...prev,
        followersCount: isFollowing ? prev.followersCount - 1 : prev.followersCount + 1
      }));
    } catch (error) {
      console.error('Error updating follow status:', error);
      toast.error('Failed to update follow status');
    }
  };

  // Load more content
  const loadMoreContent = async () => {
    if (!hasMore) return;
    
    try {
      const nextPage = page + 1;
      const { data } = await axios.get(`/api/feed/profile/${username}?page=${nextPage}`);
      
      setContent(prev => [...prev, ...data.content.items]);
      setPage(nextPage);
      setHasMore(data.content.pages > nextPage);
    } catch (error) {
      console.error('Error loading more content:', error);
      toast.error('Failed to load more content');
    }
  };

  if (loading) {
    return (
      <div className="profile-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container">
        <div className="not-found">User not found</div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-avatar">
          {profile.profilePictureUrl ? (
            <img src={profile.profilePictureUrl} alt={profile.username} />
          ) : (
            <div className="avatar-placeholder">
              {profile.username.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        
        <div className="profile-info">
          <div className="profile-actions">
            <h1>{profile.username}</h1>
            {currentUser && currentUser._id !== profile._id && (
              <button 
                onClick={handleFollow}
                className={`btn ${isFollowing ? 'btn-outline' : 'btn-primary'}`}
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
          
          <div className="profile-stats">
            <div className="stat">
              <strong>{content.length}</strong>
              <span>Summaries</span>
            </div>
            <div className="stat">
              <Link to={`/user/${profile.username}/followers`}>
                <strong>{profile.followersCount}</strong>
                <span>Followers</span>
              </Link>
            </div>
            <div className="stat">
              <Link to={`/user/${profile.username}/following`}>
                <strong>{profile.followingCount}</strong>
                <span>Following</span>
              </Link>
            </div>
          </div>
          
          {profile.bio && (
            <div className="profile-bio">
              <p>{profile.bio}</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="profile-tabs">
        <button 
          className={`tab ${activeTab === 'summaries' ? 'active' : ''}`}
          onClick={() => setActiveTab('summaries')}
        >
          Summaries
        </button>
        <button 
          className={`tab ${activeTab === 'likes' ? 'active' : ''}`}
          onClick={() => setActiveTab('likes')}
        >
          Liked
        </button>
      </div>
      
      <div className="content-grid">
        {content.length === 0 ? (
          <div className="no-content">
            <p>No {activeTab} to display</p>
          </div>
        ) : (
          content.map((item) => (
            <div key={item._id} className="content-card">
              <div className="content-header">
                <Link to={`/user/${item.userId.username}`} className="user-info">
                  {item.userId.profilePictureUrl ? (
                    <img src={item.userId.profilePictureUrl} alt={item.userId.username} />
                  ) : (
                    <div className="avatar-small">
                      {item.userId.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span>@{item.userId.username}</span>
                </Link>
                <a 
                  href={item.originalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  <FaExternalLinkAlt />
                </a>
              </div>
              
              <div className="content-preview">
                <h3>{item.title}</h3>
                <p className="summary-preview">
                  {item.summary.length > 150 
                    ? `${item.summary.substring(0, 150)}...` 
                    : item.summary}
                </p>
              </div>
              
              <div className="content-actions">
                <div className="action">
                  <FaHeart className={item.likes.some(like => like._id === currentUser?._id) ? 'liked' : ''} />
                  <span>{item.likesCount || 0}</span>
                </div>
                <div className="action">
                  <FaComment />
                  <span>{item.commentsCount || 0}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      {hasMore && (
        <div className="load-more">
          <button onClick={loadMoreContent} className="btn btn-outline">
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
