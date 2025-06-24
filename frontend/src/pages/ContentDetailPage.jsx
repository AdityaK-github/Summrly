import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { 
  FaArrowLeft, 
  FaExternalLinkAlt, 
  FaBook, 
  FaVideo, 
  FaRegCalendarAlt, 
  FaUser, 
  FaTag,
  FaLink
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import { fetchContentById } from '../store/slices/contentSlice';
import LoadingSpinner from '../components/common/LoadingSpinner';
import './ContentDetailPage.css';

const ContentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { content, loading, error } = useSelector((state) => {
    return {
      content: state.content.currentContent,
      loading: state.content.loading,
      error: state.content.error
    };
  });

  useEffect(() => {
    let isMounted = true;
    
    const loadContent = async () => {
      try {
        await dispatch(fetchContentById(id)).unwrap();
      } catch (err) {
        console.error('Failed to load content:', err);
        if (isMounted) {
          toast.error('Failed to load content. Please try again.');
          navigate('/discover');
        }
      }
    };

    if (id) {
      loadContent();
    }

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [dispatch, id, navigate]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  if (loading && !content) {
    return (
      <div className="loading-container">
        <LoadingSpinner size="xl" />
        <p className="mt-4 text-gray-600">Loading content...</p>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="content-detail-container">
        <button
          onClick={() => navigate(-1)}
          className="back-button"
        >
          <FaArrowLeft /> Back to Discover
        </button>
        <div className="error-message">
          <strong>Error: </strong>
          {error?.message || error || 'The requested content could not be found.'}
        </div>
      </div>
    );
  }

  return (
    <div className="content-detail-container">
      <button
        onClick={() => navigate(-1)}
        className="back-button"
        aria-label="Go back to previous page"
      >
        <FaArrowLeft /> Back to Discover
      </button>

      <div className="content-card">
        {/* Header */}
        <div className="content-header">
          <div className="content-meta">
            <span className={`content-type ${content.type}`}>
              {content.type === 'article' ? <FaBook className="mr-1" /> : <FaVideo className="mr-1" />}
              {content.type}
            </span>
            
            <span className="meta-item">
              <FaRegCalendarAlt />
              {formatDate(content.createdAt)}
            </span>
            
            {content.user && (
              <span className="meta-item">
                <FaUser />
                Added by{' '}
                <button 
                  className="text-primary hover:underline ml-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/user/${content.user.username}`);
                  }}
                >
                  @{content.user.username}
                </button>
              </span>
            )}
          </div>
          
          <h1 className="content-title">
            {content.title || 'Untitled Content'}
          </h1>
          
          {content.originalUrl && (
            <a
              href={content.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="original-link"
              onClick={(e) => e.stopPropagation()}
            >
              <FaLink className="inline mr-1" />
              View original content
              <FaExternalLinkAlt />
            </a>
          )}
        </div>

        {/* Summary */}
        <div className="content-body">
          <h2 className="section-title">
            <FaBook />
            Summary
          </h2>
          <div className="content-summary">
            {content.summary ? (
              <div className="prose">
                {content.summary.split('\n').map((paragraph, i) => (
                  <p key={i} className="mb-4 last:mb-0">
                    {paragraph || <br />}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic">No summary available for this content.</p>
            )}
          </div>
        </div>

        {/* Tags */}
        {content.tags?.length > 0 && (
          <div className="tags-section">
            <div className="tags-title">
              <FaTag className="inline mr-2" />
              Tags
            </div>
            <div className="tags-container">
              {content.tags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="tag"
                  onClick={() => {
                    // TODO: Add tag filtering functionality
                    console.log(`Filter by tag: ${tag}`);
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentDetailPage;
