import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { fetchAllUsers, followUser, unfollowUser } from '../store/slices/userSlice';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { FaUserPlus, FaUserCheck, FaUsers, FaUserFriends, FaSearch } from 'react-icons/fa';
import './UsersPage.css';

const UsersPage = () => {
  const dispatch = useDispatch();
  const { allUsers, loading, error, totalUsers } = useSelector((state) => state.user);
  const { user } = useSelector((state) => state.auth);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const limit = 9;

  useEffect(() => {
    dispatch(fetchAllUsers({ page, limit, search: searchQuery }));
  }, [dispatch, page, searchQuery]);

  const handleFollow = (userId) => {
    dispatch(followUser(userId));
  };

  const handleUnfollow = (userId) => {
    dispatch(unfollowUser(userId));
  };

  const isFollowing = (userId) => {
    return user?.following?.some(u => u._id === userId || u === userId);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1); // Reset to first page on new search
  };

  if (loading && page === 1) {
    return (
      <div className="loading-container">
        <LoadingSpinner size="xl" />
        <p>Loading users...</p>
      </div>
    );
  }


  return (
    <div className="users-container">
      <header className="users-header">
        <h1 className="users-title">Discover Creators</h1>
        <p className="users-subtitle">Connect with other content creators and discover amazing content</p>
        
        <form onSubmit={handleSearch} className="search-bar">
          <div className="search-input-container">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </form>
      </header>
      
      {error && <div className="error-message">{error}</div>}

      {allUsers?.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <FaUsers size={48} />
          </div>
          <h3>No users found</h3>
          <p className="empty-text">
            {searchQuery 
              ? 'No users match your search. Try different keywords.'
              : 'There are no users to display at the moment.'}
          </p>
        </div>
      ) : (
        <>
          <div className="users-grid">
            {allUsers?.map((userItem) => (
              <article key={userItem._id} className="user-card">
                <div className="user-cover">
                  <img
                    src={userItem.profilePictureUrl || '/default-avatar.png'}
                    alt={userItem.username}
                    className="user-avatar"
                  />
                </div>
                <div className="user-details">
                  <Link to={`/profile/${userItem.username}`} className="user-name">
                    @{userItem.username}
                  </Link>
                  
                  {userItem.bio && (
                    <p className="user-bio">
                      {userItem.bio.length > 100 
                        ? `${userItem.bio.substring(0, 100)}...` 
                        : userItem.bio}
                    </p>
                  )}
                  
                  <div className="user-stats">
                    <div className="stat">
                      <div className="stat-value">{userItem.followersCount || 0}</div>
                      <div className="stat-label">Followers</div>
                    </div>
                    <div className="stat">
                      <div className="stat-value">{userItem.followingCount || 0}</div>
                      <div className="stat-label">Following</div>
                    </div>
                    <div className="stat">
                      <div className="stat-value">{userItem.postsCount || 0}</div>
                      <div className="stat-label">Posts</div>
                    </div>
                  </div>
                  
                  {userItem._id !== user?._id && (
                    <button
                      onClick={() => 
                        isFollowing(userItem._id) 
                          ? handleUnfollow(userItem._id)
                          : handleFollow(userItem._id)
                      }
                      className={`follow-button ${isFollowing(userItem._id) ? 'following' : ''}`}
                    >
                      {isFollowing(userItem._id) ? (
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
              </article>
            ))}
          </div>

          {/* Pagination */}
          {totalUsers > limit && (
            <div className="pagination">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="pagination-button"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {page} of {Math.ceil(totalUsers / limit)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= totalUsers}
                className="pagination-button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default UsersPage;
