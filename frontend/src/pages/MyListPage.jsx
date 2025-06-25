import React, { useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchUserContent } from '../store/slices/contentSlice';
import { FaSpinner, FaExclamationCircle, FaBook, FaVideo, FaLink, FaExternalLinkAlt } from 'react-icons/fa';
import './MyListPage.css';

const MyListPage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { userContent, loading, error } = useSelector((state) => state.content);

  const fetchContent = useCallback(() => {
    if (user) {
      dispatch(fetchUserContent({ userId: user._id }));
    }
  }, [dispatch, user]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const renderContentItem = (item) => {
    const isArticle = item.type === 'article';
    
    return (
      <div key={item._id} className="content-item">
        <div className="content-icon">
          {isArticle ? <FaBook /> : <FaVideo />}
        </div>
        <div className="content-details">
          <h3>
            <a href={`/content/${item._id}`} className="content-title-link">
              {item.title}
            </a>
          </h3>
          <p className="content-summary">
            {item.summary ? (
              <a href={`/content/${item._id}`} className="content-summary-link">
                {item.summary.length > 150 ? `${item.summary.substring(0, 150)}...` : item.summary}
                {item.summary.length > 150 && <span className="read-more">Read more</span>}
              </a>
            ) : (
              'No summary available'
            )}
          </p>
          <div className="content-meta">
            <span className="content-type">{item.type}</span>
            <span className="content-date">
              {new Date(item.createdAt).toLocaleDateString()}
            </span>
            <a 
              href={item.originalUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="content-link"
            >
              <FaExternalLinkAlt /> Original
            </a>
          </div>
          {item.tags && item.tags.length > 0 && (
            <div className="content-tags">
              {item.tags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="auth-required">
        <h2>Sign In Required</h2>
        <p>Please sign in to view your saved content.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="loading-container">
        <FaSpinner className="spinner" />
        <p>Loading your content...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <FaExclamationCircle className="error-icon" />
        <p>Error loading your content. Please try again later.</p>
        <button 
          onClick={() => dispatch(fetchUserContent())}
          className="retry-button"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="my-list-container">
      <div className="page-header">
        <h1>My Saved Content</h1>
        <p>View and manage all your saved articles and videos</p>
      </div>
      
      <div className="content-list">
        {userContent.length > 0 ? (
          userContent.map(renderContentItem)
        ) : (
          <div className="empty-state">
            <p>You haven't saved any content yet.</p>
            <a href="/add" className="add-content-button">
              Add Your First Item
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyListPage;
