/**
 * Summrly Browser Extension - Popup Script
 * Handles the popup UI and user interactions
 */

// Wrap everything in an IIFE to avoid polluting the global scope
(function() {
  'use strict';

  // =============================================
  // DOM Elements
  // =============================================
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const viewSavedBtn = document.getElementById('viewSavedBtn');
  const addToSummariesBtn = document.getElementById('addToSummariesBtn');
  const userInfo = document.getElementById('userInfo');
  const loginContainer = document.getElementById('loginContainer');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const statusMessage = document.getElementById('statusMessage');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');
  const currentUrlInfo = document.getElementById('currentUrlInfo');
  const currentUrlLink = document.getElementById('currentUrlLink');
  const currentUrlTitle = document.getElementById('currentUrlTitle');
  const loadingState = document.getElementById('loadingState');
  const unauthenticatedState = document.getElementById('unauthenticatedState');
  const authenticatedState = document.getElementById('authenticatedState');

  // =============================================
  // State
  // =============================================
  let isLoading = false;
  let currentUser = null;
  let authState = {
    isAuthenticated: false,
    user: null,
    token: null,
    lastUpdated: null
  };

  // =============================================
  // Initialization
  // =============================================
  
  // Wait for the DOM to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded, initialize immediately
    setTimeout(init, 0);
  }
  
  /**
   * Main initialization function
   */
  async function init() {
    try {
      console.log('[Popup] Initializing popup...');
      
      // Set up the UI and event listeners
      setupEventListeners();
      
      // Check authentication state
      await checkAuthState();
      
      // Set up message listener for auth state changes
      setupMessageListener();
      
      console.log('[Popup] Popup initialized successfully');
    } catch (error) {
      console.error('[Popup] Error initializing popup:', error);
      showStatus('Error initializing popup', 'error');
    }
  }

  // =============================================
  // Event Listeners
  // =============================================
  
  /**
   * Set up all event listeners
   */
  function setupEventListeners() {
    // Login/Logout buttons
    if (loginBtn) {
      loginBtn.addEventListener('click', handleLogin);
    }
    
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Action buttons
    if (summarizeBtn) {
      summarizeBtn.addEventListener('click', handleSummarize);
    }
    
    if (viewSavedBtn) {
      viewSavedBtn.addEventListener('click', handleViewSaved);
    }
    
    if (addToSummariesBtn) {
      addToSummariesBtn.addEventListener('click', handleAddToSummaries);
    }
  }

  // =============================================
  // Authentication
  // =============================================
  
  /**
   * Check the current authentication state
   */
  async function checkAuthState() {
    console.log('[Popup] Checking authentication state...');
    setLoading(true);
    
    try {
      // First check local storage
      const result = await chrome.storage.local.get('authState');
      const storedAuth = result.authState;
      
      if (storedAuth?.isAuthenticated && storedAuth?.user && storedAuth?.token) {
        console.log('[Popup] Found stored auth state');
        authState = { ...storedAuth };
        currentUser = authState.user;
        updateUIForLoggedInUser(authState.user, authState.token);
        return true;
      }
      
      // If no valid auth in storage, check with background script
      console.log('[Popup] No valid auth in storage, checking with background...');
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'checkAuth' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('[Popup] Error checking auth:', chrome.runtime.lastError);
              resolve({ isAuthenticated: false });
              return;
            }
            resolve(response || { isAuthenticated: false });
          }
        );
      });
      
      if (response.isAuthenticated && response.user) {
        console.log('[Popup] Background confirmed user is authenticated');
        authState = {
          isAuthenticated: true,
          user: response.user,
          token: response.token,
          lastUpdated: Date.now()
        };
        currentUser = response.user;
        
        // Update local storage
        await chrome.storage.local.set({ authState });
        
        updateUIForLoggedInUser(response.user, response.token);
        return true;
      }
      
      // If we get here, user is not authenticated
      console.log('[Popup] User is not authenticated');
      updateUIForLoggedOutUser();
      return false;
      
    } catch (error) {
      console.error('[Popup] Error checking auth state:', error);
      showStatus('Error checking authentication status', 'error');
      updateUIForLoggedOutUser();
      return false;
    } finally {
      setLoading(false);
    }
  }
  
  /**
   * Handle login button click
   */
  async function handleLogin() {
    if (isLoading) return;
    
    try {
      console.log('[Popup] Starting login process');
      setLoading(true, true);
      showStatus('Opening Google login...', 'info');
      
      // Clear any existing auth state
      await chrome.storage.local.remove('authState');
      authState = { isAuthenticated: false, user: null, token: null, lastUpdated: null };
      currentUser = null;
      updateUIForLoggedOutUser();
      
      // Send message to background script to handle login
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'login' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('[Popup] Error sending login message:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            resolve(response || { success: false, error: 'No response' });
          }
        );
      });
      
      console.log('[Popup] Login response:', response);
      
      if (response.success) {
        console.log('[Popup] Login successful, waiting for auth state update...');
        // The background script will send an AUTH_STATE_CHANGED message
        // We'll handle UI updates in the message listener
      } else {
        throw new Error(response.error || 'Login failed');
      }
      
    } catch (error) {
      console.error('[Popup] Error during login:', error);
      showStatus(error.message || 'Login failed. Please try again.', 'error');
      updateUIForLoggedOutUser();
    } finally {
      setLoading(false);
    }
  }
  
  /**
   * Handle logout button click
   */
  async function handleLogout() {
    if (isLoading) return;
    
    try {
      console.log('[Popup] Starting logout process');
      setLoading(true);
      showStatus('Logging out...', 'info');
      
      // Send message to background script to handle logout
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'logout' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('[Popup] Error sending logout message:', chrome.runtime.lastError);
              resolve({ success: false, error: chrome.runtime.lastError.message });
              return;
            }
            resolve(response || { success: false, error: 'No response' });
          }
        );
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Logout failed');
      }
      
      console.log('[Popup] Logout successful');
      
      // Clear local state
      authState = { isAuthenticated: false, user: null, token: null, lastUpdated: null };
      currentUser = null;
      await chrome.storage.local.remove('authState');
      
      // Update UI
      updateUIForLoggedOutUser();
      showStatus('You have been logged out', 'info');
      
    } catch (error) {
      console.error('[Popup] Error during logout:', error);
      showStatus(error.message || 'Error during logout', 'error');
    } finally {
      setLoading(false);
    }
  }
  
  // =============================================
  // Message Handling
  // =============================================
  
  /**
   * Set up message listener for communication with background script
   */
  function setupMessageListener() {
    const handleMessage = (message, sender, sendResponse) => {
      console.log('[Popup] Received message:', message);
      
      if (!message || typeof message !== 'object') {
        return false;
      }
      
      // Handle auth state changes
      if (message.type === 'AUTH_STATE_CHANGED') {
        handleAuthStateChanged(message);
        return true; // Keep the message channel open for async response
      }
      
      // Handle other message types here if needed
      
      return false;
    };
    
    // Add the message listener
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Return cleanup function
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }
  
  /**
   * Handle authentication state changes from background script
   */
  function handleAuthStateChanged(message) {
    console.log('[Popup] Auth state changed:', {
      isAuthenticated: message.isAuthenticated,
      user: message.user ? { name: message.user.name, email: message.user.email } : null
    });
    
    try {
      if (message.isAuthenticated && message.user) {
        // Update auth state
        authState = {
          isAuthenticated: true,
          user: message.user,
          token: message.token,
          lastUpdated: Date.now()
        };
        currentUser = message.user;
        
        // Persist to storage
        chrome.storage.local.set({ authState }).catch(error => {
          console.error('[Popup] Failed to persist auth state:', error);
        });
        
        // Update UI
        updateUIForLoggedInUser(message.user, message.token);
        showStatus('Successfully authenticated!', 'success');
        
      } else {
        // User logged out or not authenticated
        authState = { isAuthenticated: false, user: null, token: null, lastUpdated: null };
        currentUser = null;
        
        // Clear from storage
        chrome.storage.local.remove('authState').catch(error => {
          console.error('[Popup] Failed to clear auth state:', error);
        });
        
        // Update UI
        updateUIForLoggedOutUser();
        
        if (message.error) {
          console.error('[Popup] Auth error:', message.error);
          showStatus(message.error, 'error');
        } else {
          showStatus('You have been signed out', 'info');
        }
      }
      
    } catch (error) {
      console.error('[Popup] Error handling auth state change:', error);
      showStatus('Error updating authentication status', 'error');
    }
  }
  
  // =============================================
  // UI Updates
  // =============================================
  
  /**
   * Update UI for logged in user
   */
  function updateUIForLoggedInUser(user, token) {
    console.log('[Popup] Updating UI for logged in user:', user.email);
    
    // Update user info
    if (userAvatar) userAvatar.src = user.picture || 'images/default-avatar.png';
    if (userName) userName.textContent = user.name || 'User';
    if (userEmail) userEmail.textContent = user.email || '';
    
    // Show authenticated state
    if (loginContainer) loginContainer.classList.add('hidden');
    if (userInfo) userInfo.classList.remove('hidden');
    
    // Update buttons
    if (loginBtn) loginBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (summarizeBtn) summarizeBtn.classList.remove('hidden');
    if (viewSavedBtn) viewSavedBtn.classList.remove('hidden');
    
    // Get current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        const url = tabs[0].url;
        const title = tabs[0].title || 'Untitled Page';
        
        // Only show for http/https URLs
        if (url.startsWith('http')) {
          // Update current URL display
          if (currentUrlLink) currentUrlLink.href = url;
          if (currentUrlLink) currentUrlLink.textContent = new URL(url).hostname;
          if (currentUrlTitle) currentUrlTitle.textContent = title;
          if (currentUrlInfo) currentUrlInfo.classList.remove('hidden');
          
          // Show the add to summaries button
          if (addToSummariesBtn) {
            addToSummariesBtn.classList.remove('hidden');
            addToSummariesBtn.disabled = false;
            addToSummariesBtn.textContent = 'Add to My Summaries';
            
            // Check if this URL is already saved
            checkIfPageIsSaved(url).then(isSaved => {
              if (isSaved && addToSummariesBtn) {
                addToSummariesBtn.disabled = true;
                addToSummariesBtn.textContent = 'Already Saved';
              }
            }).catch(error => {
              console.error('Error checking if page is saved:', error);
            });
          }
        } else if (currentUrlInfo) {
          currentUrlInfo.classList.add('hidden');
          if (addToSummariesBtn) addToSummariesBtn.classList.add('hidden');
        }
      } else if (currentUrlInfo) {
        currentUrlInfo.classList.add('hidden');
        if (addToSummariesBtn) addToSummariesBtn.classList.add('hidden');
      }
    });
    
    // Hide loading and unauthenticated states
    if (loadingState) loadingState.classList.add('hidden');
    if (unauthenticatedState) unauthenticatedState.classList.add('hidden');
    if (authenticatedState) authenticatedState.classList.remove('hidden');
  }
  
  /**
   * Update UI for logged out user
   */
  function updateUIForLoggedOutUser() {
    console.log('[Popup] Updating UI for logged out user');
    
    // Show login UI
    if (loginContainer) loginContainer.classList.remove('hidden');
    if (userInfo) userInfo.classList.add('hidden');
    
    // Update buttons
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
    if (summarizeBtn) summarizeBtn.classList.add('hidden');
    if (viewSavedBtn) viewSavedBtn.classList.add('hidden');
    
    // Hide current URL info
    if (currentUrlInfo) currentUrlInfo.classList.add('hidden');
    
    // Show unauthenticated state
    if (loadingState) loadingState.classList.add('hidden');
    if (unauthenticatedState) unauthenticatedState.classList.remove('hidden');
    if (authenticatedState) authenticatedState.classList.add('hidden');
  }
  
  /**
   * Show a status message to the user
   */
  function showStatus(message, type = 'info') {
    console.log(`[Popup] Status (${type}):`, message);
    
    if (!statusMessage) return;
    
    // Clear previous classes
    statusMessage.className = 'status-message';
    
    // Add type-specific class
    if (type === 'error') {
      statusMessage.classList.add('error');
    } else if (type === 'success') {
      statusMessage.classList.add('success');
    } else if (type === 'warning') {
      statusMessage.classList.add('warning');
    } else {
      statusMessage.classList.add('info');
    }
    
    // Set message and show
    statusMessage.textContent = message;
    statusMessage.classList.remove('hidden');
    
    // Auto-hide after 5 seconds if not an error
    if (type !== 'error') {
      setTimeout(() => {
        if (statusMessage.textContent === message) {
          statusMessage.classList.add('hidden');
        }
      }, 5000);
    }
  }
  
  /**
   * Set loading state
   */
  function setLoading(loading, force = false) {
    if (isLoading === loading && !force) return;
    
    isLoading = loading;
    console.log(`[Popup] Loading state: ${loading ? 'ON' : 'OFF'}`);
    
    if (loadingIndicator) {
      if (loading) {
        loadingIndicator.classList.remove('hidden');
      } else {
        loadingIndicator.classList.add('hidden');
      }
    }
    
    // Disable buttons while loading
    const buttons = [loginBtn, logoutBtn, summarizeBtn, viewSavedBtn, addToSummariesBtn];
    buttons.forEach(btn => {
      if (btn) {
        btn.disabled = loading;
      }
    });
  }
  
  // =============================================
  // Page Saving
  // =============================================
  
  /**
   * Check if the current page is already saved in the user's summaries
   */
  async function checkIfPageIsSaved(url) {
    if (!url || !url.startsWith('http')) return false;
    
    try {
      console.log('[Popup] Checking if page is already saved:', url);
      
      // First check local storage for a cached result
      const cacheKey = `saved_page_${btoa(url)}`;
      const cachedResult = localStorage.getItem(cacheKey);
      
      if (cachedResult) {
        const { timestamp, isSaved } = JSON.parse(cachedResult);
        // Cache is valid for 5 minutes
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          console.log('[Popup] Using cached result for URL:', { url, isSaved });
          return isSaved;
        }
      }
      
      // If no valid cache, check with the server
      const response = await fetch(`http://localhost:5003/api/contentitems/check?url=${encodeURIComponent(url)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authState?.token || ''}`
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token might be expired, try to refresh it
          await checkAuthState();
          return checkIfPageIsSaved(url); // Retry with fresh token
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('[Popup] Page check result:', { url, exists: data.exists });
      
      // Cache the result
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        isSaved: data.exists
      }));
      
      return data.exists;
      
    } catch (error) {
      console.error('[Popup] Error checking if page is saved:', error);
      // If there's an error, assume the page is not saved to allow the user to try saving it
      return false;
    }
  }
  
  /**
   * Handle add to summaries button click
   */
  async function handleAddToSummaries() {
    if (!currentUser) {
      showStatus('Please log in to save pages', 'error');
      return;
    }
    
    if (isLoading) return;
    setLoading(true);
    
    try {
      showStatus('Saving page to your summaries...', 'info');
      
      // Get current tab info
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.url) {
        throw new Error('Could not get current tab information');
      }
      
      const url = tab.url;
      const title = tab.title || 'Untitled Page';
      
      // Validate URL
      if (!url.startsWith('http')) {
        throw new Error('Only web pages (http/https) can be saved');
      }
      
      // Double-check if already saved (in case of race conditions)
      const isSaved = await checkIfPageIsSaved(url);
      if (isSaved) {
        showStatus('This page is already in your summaries', 'info');
        return;
      }
      
      // Show loading state on the button
      if (addToSummariesBtn) {
        addToSummariesBtn.disabled = true;
        addToSummariesBtn.innerHTML = '<span class="spinner"></span> Saving...';
      }
      
      // Save the page using the background script to handle authentication
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            action: 'savePage',
            data: { url, title }
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve(response);
          }
        );
      });
      
      if (response && response.success) {
        console.log('Page saved successfully:', response.data);
        showStatus('Page saved to your summaries!', 'success');
        
        // Update the button state
        if (addToSummariesBtn) {
          addToSummariesBtn.disabled = true;
          addToSummariesBtn.textContent = 'Saved!';
        }
        
        // Update local cache
        const cacheKey = `saved_page_${btoa(url)}`;
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          isSaved: true
        }));
        
        // Notify any other parts of the extension
        chrome.runtime.sendMessage({
          type: 'PAGE_SAVED',
          data: { url, title }
        });
        
      } else {
        throw new Error(response?.error || 'Failed to save page');
      }
      
    } catch (error) {
      console.error('Error saving page:', error);
      
      // Reset button state on error
      if (addToSummariesBtn) {
        addToSummariesBtn.disabled = false;
        addToSummariesBtn.textContent = 'Add to My Summaries';
      }
      
      // Show appropriate error message
      let errorMessage = 'Failed to save page';
      if (error.message.includes('NetworkError')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Session expired. Please log in again.';
        // Trigger re-authentication
        checkAuthState();
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showStatus(`Error: ${errorMessage}`, 'error');
      
    } finally {
      setLoading(false);
    }
  }
  
  // =============================================
  // Other Handlers (stubs for now)
  // =============================================
  
  /**
   * Handle summarize button click
   */
  function handleSummarize() {
    showStatus('Summarize feature coming soon!', 'info');
  }
  
  /**
   * Handle view saved button click
   */
  function handleViewSaved() {
    // Open the options page or a new tab with the saved items
    chrome.runtime.sendMessage({ action: 'openOptionsPage' });
  }
  
})();
