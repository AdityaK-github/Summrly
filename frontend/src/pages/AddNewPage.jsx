import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createContentItem } from '../store/slices/contentSlice';
import { FaSpinner, FaCheck, FaExclamationCircle, FaLink, FaGlobe, FaLock, FaLockOpen, FaHeading } from 'react-icons/fa';
import './AddNewPage.css';

const AddNewPage = () => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('article');
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isTitleFocused, setIsTitleFocused] = useState(false);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading } = useSelector((state) => state.content);

  // Auto-generate title from URL when URL changes and title is empty or not manually edited
  useEffect(() => {
    if (url && !isTitleFocused) {
      try {
        const urlObj = new URL(url);
        let generatedTitle = urlObj.hostname.replace('www.', '');
        // Capitalize first letter of each word in the domain
        generatedTitle = generatedTitle
          .split('.')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        setTitle(generatedTitle);
      } catch (e) {
        // If URL is invalid, don't update title
      }
    }
  }, [url, isTitleFocused]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Form validation
    if (!url) {
      setError('Please enter a URL');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (err) {
      setError('Please enter a valid URL (include http:// or https://)');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const resultAction = await dispatch(createContentItem({ 
        originalUrl: url,
        title: title.trim(),
        type, 
        isPublic 
      }));
      
      if (createContentItem.fulfilled.match(resultAction)) {
        setSuccess(true);
        // Reset form
        setUrl('');
        setTitle('');
        // Redirect to the content detail page or my-list after a short delay
        setTimeout(() => {
          navigate('/my-list');
        }, 1500);
      } else {
        throw new Error(resultAction.payload || 'Failed to create content item');
      }
    } catch (err) {
      setError(err.message || 'Failed to process the URL. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-new-container">
      <div className="add-new-card">
        <h2 className="add-new-title">Add New Content</h2>
        <p className="add-new-subtitle">Add a URL to summarize and save to your list</p>
        
        {error && (
          <div className="alert alert-error">
            <FaExclamationCircle className="icon" />
            <span>{error}</span>
          </div>
        )}
        
        {success && (
          <div className="alert alert-success">
            <FaCheck className="icon" />
            <span>Content added successfully! Redirecting...</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="add-new-form">
          <div className="form-group">
            <label htmlFor="url" className="form-label">
              <FaLink className="input-icon" /> URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="form-input"
              disabled={isSubmitting || loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="title" className="form-label">
              <FaHeading className="input-icon" /> Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={() => setIsTitleFocused(true)}
              onBlur={() => setIsTitleFocused(false)}
              placeholder="Enter a title for this content"
              className="form-input"
              disabled={isSubmitting || loading}
              required
            />
            <p className="input-hint">
              {!isTitleFocused && url && !title.trim() ? 'Title will be auto-generated from URL' : ''}
            </p>
          </div>
          
          <div className="form-group">
            <label className="form-label">
              <FaGlobe className="input-icon" /> Content Type
            </label>
            <div className="radio-group">
              <label className="radio-label">
                <input
                  type="radio"
                  value="article"
                  checked={type === 'article'}
                  onChange={() => setType('article')}
                  disabled={isSubmitting || loading}
                  className="radio-input"
                />
                <span className="radio-custom"></span>
                Article
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  value="video"
                  checked={type === 'video'}
                  onChange={() => setType('video')}
                  disabled={isSubmitting || loading}
                  className="radio-input"
                />
                <span className="radio-custom"></span>
                Video
              </label>
            </div>
          </div>
          
          <div className="form-group">
            <label className="checkbox-label">
              <div className="checkbox-container">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  disabled={isSubmitting || loading}
                  className="checkbox-input"
                />
                <span className="checkbox-custom">
                  {isPublic ? <FaGlobe className="icon" /> : <FaLock className="icon" />}
                </span>
              </div>
              <span className="checkbox-text">
                {isPublic ? 'Public (visible to others)' : 'Private (only visible to you)'}
              </span>
            </label>
          </div>
          
          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting || loading || !url || !title.trim()}
          >
            {isSubmitting || loading ? (
              <>
                <FaSpinner className="spinner" />
                Processing...
              </>
            ) : (
              'Add Content'
            )}
          </button>
        </form>
        
        <div className="add-new-tips">
          <h4>Tips:</h4>
          <ul>
            <li>Make sure the URL is publicly accessible</li>
            <li>For best results, use direct links to articles or videos</li>
            <li>Processing may take a moment depending on the content length</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AddNewPage;
