// Wrap everything in an IIFE to avoid polluting the global scope
(function() {
  'use strict';
  
  // Wait for the DOM to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already loaded, initialize immediately
    setTimeout(init, 0);
  }

  // Main initialization function
  async function init() {
    try {
      // Initialize the application
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
  // DOM Elements
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
  
  // UI State Elements
  const loadingState = document.getElementById('loadingState');
  const unauthenticatedState = document.getElementById('unauthenticatedState');
  const authenticatedState = document.getElementById('authenticatedState');

  // State
  let isLoading = false;
  let currentUser = null;

  // Set up event listeners
  function setupEventListeners() {
    loginBtn?.addEventListener('click', handleLogin);
    logoutBtn?.addEventListener('click', handleLogout);
    summarizeBtn?.addEventListener('click', handleSummarize);
    viewSavedBtn?.addEventListener('click', handleViewSaved);
    addToSummariesBtn?.addEventListener('click', handleAddToSummaries);
    
    // Check current tab when popup opens
    updateCurrentTabInfo();
  }
  
  // Update UI based on authentication state and current tab
  async function updateUI() {
    if (isLoading) {
      showLoadingState();
      return;
    }
    
    if (currentUser) {
      await updateUIForLoggedInUser(currentUser);
    } else {
      updateUIForLoggedOutUser();
    }
    
    // Always update current tab info
    await updateCurrentTabInfo();
  }
  
  // Handle View Saved Summaries
  function handleViewSaved() {
    // Open the extension's options page or a new tab with saved summaries
    chrome.tabs.create({ url: chrome.runtime.getURL('saved.html') });
  }

  // Check authentication state with timeout
  async function checkAuthState() {
    console.log('[Popup] Checking authentication state...');
    showLoadingState();
    
    // Set a timeout to prevent infinite loading
    const authCheckTimeout = setTimeout(() => {
      console.warn('[Popup] Auth check timed out after 5 seconds');
      updateUIForLoggedOutUser();
      showStatus('Connection timed out. Please try again.', 'error');
    }, 5000);
    
    try {
      // First check with the background script for the most up-to-date state
      console.log('[Popup] Checking with background script for auth state...');
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'CHECK_AUTH' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('[Popup] Error in sendMessage callback:', chrome.runtime.lastError);
              resolve(null);
              return;
            }
            console.log('[Popup] Received response from background:', response);
            resolve(response);
          }
        );
      });
      
      // Clear the timeout
      clearTimeout(authCheckTimeout);
      
      if (response?.isAuthenticated && response?.user) {
        console.log('[Popup] User is authenticated (from background):', response.user.email);
        currentUser = response.user;
        
        // Update UI immediately
        updateUIForLoggedInUser(response.user, response.token);
        
        // Update local storage for future use
        await chrome.storage.local.set({
          authState: {
            isAuthenticated: true,
            user: response.user,
            token: response.token,
            lastUpdated: Date.now()
          }
        });
        
        return true;
      }
      
      console.log('[Popup] No valid auth state found from background, checking local storage...');
      
      // Fall back to local storage if background check fails
      const localResult = await chrome.storage.local.get(['authState']);
      const authState = localResult?.authState;
      
      if (authState?.isAuthenticated && authState?.user) {
        console.log('[Popup] Found valid auth state in local storage:', authState.user.email);
        currentUser = authState.user;
        updateUIForLoggedInUser(authState.user, authState.token);
        return true;
      }
      
      // If we get here, user is not authenticated
      console.log('[Popup] No valid authentication found');
      updateUIForLoggedOutUser();
      return false;
    } catch (error) {
      console.error('[Popup] Error in checkAuthState:', error);
      updateUIForLoggedOutUser();
      showStatus('Error checking login status: ' + (error.message || ''), 'error');
      return false;
    }
  }
  }

  // Handle login
  async function handleLogin() {
    console.log('[Popup] Starting login process');
    setLoading(true, true);
    showStatus('Opening Google login...', 'info');
    
    try {
      // Clear any existing auth state
      console.log('[Popup] Clearing existing auth state');
      await chrome.storage.local.remove('authState');
      currentUser = null;
      updateUI();
      
      // Send message to background script to handle login
      console.log('[Popup] Sending login message to background script');
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { action: 'login' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('[Popup] Error sending login message:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
              return;
            }
            console.log('[Popup] Received response from background:', response);
            resolve(response);
          }
        );
      });
      
      console.log('[Popup] Login response:', response);
      
      if (response?.success) {
        console.log('[Popup] Login successful, refreshing UI');
        // The background script will update the auth state, which will trigger the message listener
        await checkAuthState();
        
        // Set a timeout in case the auth state update doesn't come through
        setTimeout(() => {
          if (!currentUser) {
            console.warn('[Popup] Auth state update not received, forcing check...');
            checkAuthState();
          }
        }, 2000);
      } else {
        throw new Error(response?.error || 'Login failed');
      }
    } catch (error) {
      console.error('[Popup] Error during login:', error);
      showStatus(error.message || 'Login failed. Please try again.', 'error');
      updateUIForLoggedOutUser();
    } finally {
      setLoading(false);
    }
  }

  // Handle logout
  async function handleLogout() {
    try {
      setLoading(true);
      showStatus('Signing out...', 'info');
      
      const response = await chrome.runtime.sendMessage({ action: 'logout' });
      
      if (response && response.success) {
        updateUIForLoggedOutUser();
        showStatus('Successfully signed out', 'success');
      } else {
        throw new Error(response?.error || 'Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Handle summarize action
  async function handleSummarize() {
    console.log('Summarize button clicked');
    
    if (!currentUser) {
      showStatus('Please log in to summarize pages', 'error');
      return;
    }
    
    setLoading(true, 'Generating summary...');
    
    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('No active tab found');
      }
      
      console.log('Current tab:', tab);
      
      // Show initial status
      showStatus('Extracting page content...', 'info');
      
      // Send message to background script to handle summarization
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { 
            action: 'summarize', 
            data: { 
              url: tab.url,
              title: tab.title
            } 
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });
      
      if (response && response.success) {
        showStatus('Summary generated and saved successfully!', 'success');
        
        // Update the UI to show the page is now saved
        const addToSummariesBtn = document.getElementById('addToSummariesBtn');
        if (addToSummariesBtn) {
          addToSummariesBtn.disabled = true;
          addToSummariesBtn.innerHTML = '✓ Saved to Summaries';
        }
        
        // Open the summary in a new tab if we have the URL
        if (response.data && response.data._id) {
          // You can modify this URL to match your web app's route for viewing a summary
          const summaryUrl = `http://localhost:3000/summaries/${response.data._id}`;
          chrome.tabs.create({ url: summaryUrl });
        }
      } else {
        throw new Error(response?.error || 'Failed to generate summary');
      }
    } catch (error) {
      console.error('Error in handleSummarize:', error);
      showStatus(error.message || 'Failed to generate summary', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Check if the current page is already saved in the user's summaries
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

  // Handle adding current page to summaries
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
      const addToSummariesBtn = document.getElementById('addToSummariesBtn');
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
      const addToSummariesBtn = document.getElementById('addToSummariesBtn');
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

  // Update current tab info
  async function updateCurrentTabInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
        if (currentUrlInfo) currentUrlInfo.style.display = 'none';
        return;
      }
      
      if (currentUrlInfo) {
        currentUrlInfo.style.display = 'block';
        if (currentUrlLink) {
          currentUrlLink.href = tab.url;
          currentUrlLink.textContent = tab.title || tab.url;
        }
        if (currentUrlTitle) {
          currentUrlTitle.textContent = tab.title || 'Untitled';
        }
      }
      
      // Check if the current page is already in the user's summaries
      if (currentUser) {
        const { authState } = await chrome.storage.local.get('authState');
        if (authState?.token) {
          const response = await fetch(`http://localhost:5003/api/contentitems/check?url=${encodeURIComponent(tab.url)}`, {
            headers: {
              'Authorization': `Bearer ${authState.token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (addToSummariesBtn) {
              if (data.exists) {
                addToSummariesBtn.textContent = '✓ In Your Summaries';
                addToSummariesBtn.disabled = true;
              } else {
                addToSummariesBtn.textContent = 'Add to My Summaries';
                addToSummariesBtn.disabled = false;
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Error updating current tab info:', error);
    }
  }

  // Update UI for logged in user
  async function updateUIForLoggedInUser(user, token) {
    console.log('[Popup] Updating UI for logged in user:', user.email);
    
    // Update user info
    if (userAvatar) userAvatar.src = user.picture || 'images/default-avatar.png';
    if (userName) userName.textContent = user.name || 'User';
    if (userEmail) userEmail.textContent = user.email || '';
    
    // Show authenticated state
    loginContainer.classList.add('hidden');
    userInfo.classList.remove('hidden');
    
    // Update buttons
    if (loginBtn) loginBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
    if (summarizeBtn) summarizeBtn.classList.remove('hidden');
    if (viewSavedBtn) viewSavedBtn.classList.remove('hidden');
    
    // Get current tab info
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (tabs && tabs[0] && tabs[0].url) {
        const url = tabs[0].url;
        const title = tabs[0].title || 'Untitled Page';
        
        // Only show for http/https URLs
        if (url.startsWith('http')) {
          // Update current URL display
          currentUrlLink.href = url;
          currentUrlLink.textContent = new URL(url).hostname;
          currentUrlTitle.textContent = title;
          currentUrlInfo.classList.remove('hidden');
          
          // Show the add to summaries button
          const addToSummariesBtn = document.getElementById('addToSummariesBtn');
          if (addToSummariesBtn) {
            addToSummariesBtn.classList.remove('hidden');
            addToSummariesBtn.disabled = false;
            addToSummariesBtn.textContent = 'Add to My Summaries';
            
            // Check if this URL is already saved
            try {
              const isSaved = await checkIfPageIsSaved(url);
              if (isSaved) {
                addToSummariesBtn.disabled = true;
                addToSummariesBtn.textContent = 'Already Saved';
              }
            } catch (error) {
              console.error('Error checking if page is saved:', error);
            }
          }
        } else {
          currentUrlInfo.classList.add('hidden');
          const addToSummariesBtn = document.getElementById('addToSummariesBtn');
          if (addToSummariesBtn) addToSummariesBtn.classList.add('hidden');
        }
      } else {
        currentUrlInfo.classList.add('hidden');
        const addToSummariesBtn = document.getElementById('addToSummariesBtn');
        if (addToSummariesBtn) addToSummariesBtn.classList.add('hidden');
      }
    });
    
    // Hide loading and unauthenticated states
    if (loadingState) loadingState.classList.add('hidden');
    if (unauthenticatedState) unauthenticatedState.classList.add('hidden');
    if (authenticatedState) authenticatedState.classList.remove('hidden');
    
    // Update status
    showStatus('You are logged in', 'success');
    // Update current tab info
    await updateCurrentTabInfo();
    
    console.log('UI updated for logged in user:', user.email);
    return user;
  }

  // Update UI for logged out user
  function updateUIForLoggedOutUser() {
    console.log('Updating UI for logged out user');
    
    // Prevent infinite loops by setting loading state without UI update
    setLoading(false, true);
    
    try {
      // Clear current user state
      currentUser = null;
      
      // Show unauthenticated state, hide others
      if (unauthenticatedState) unauthenticatedState.style.display = 'block';
      if (authenticatedState) authenticatedState.style.display = 'none';
      if (loadingState) loadingState.style.display = 'none';
      if (loadingIndicator) loadingIndicator.style.display = 'none';
      
      // Show login button, hide logout button and user info
      if (loginBtn) {
        loginBtn.style.display = 'block';
        loginBtn.disabled = false;
      }
      
      if (logoutBtn) {
        logoutBtn.style.display = 'none';
        logoutBtn.disabled = true;
      }
      
      if (loginContainer) loginContainer.style.display = 'block';
      if (userInfo) userInfo.style.display = 'none';
      
      // Reset user info
      if (userAvatar) {
        userAvatar.src = '';
        userAvatar.className = 'user-avatar';
        userAvatar.alt = 'User Avatar';
      }
      
      if (userName) userName.textContent = '';
      if (userEmail) userEmail.textContent = '';
      
      // Update buttons state
      if (summarizeBtn) {
        summarizeBtn.disabled = true;
        // Reset any loading state in the button
        if (summarizeBtn.hasAttribute('data-original-html')) {
          summarizeBtn.innerHTML = summarizeBtn.getAttribute('data-original-html');
          summarizeBtn.removeAttribute('data-original-html');
        }
      }
      
      if (viewSavedBtn) {
        viewSavedBtn.disabled = true;
        // Reset any loading state in the button
        if (viewSavedBtn.hasAttribute('data-original-html')) {
          viewSavedBtn.innerHTML = viewSavedBtn.getAttribute('data-original-html');
          viewSavedBtn.removeAttribute('data-original-html');
        }
      }
      
      // Clear any existing status messages after a delay
      if (statusMessage) {
        setTimeout(() => {
          statusMessage.style.display = 'none';
          statusMessage.textContent = '';
          statusMessage.className = 'status-message';
        }, 3000);
      }
      
      console.log('UI updated for logged out user');
    } catch (error) {
      console.error('Error updating UI for logged out user:', error);
    }
  }

  // Show status message
  function showStatus(message, type = 'info') {
    if (!statusMessage) return;
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} visible`;
    
    // Auto-hide after 5 seconds
    clearTimeout(window.statusTimeout);
    window.statusTimeout = setTimeout(() => {
      statusMessage.classList.remove('visible');
    }, 5000);
  }

  // Set loading state
  function setLoading(loading, skipUIUpdate = false) {
    // Prevent unnecessary updates
    if (isLoading === loading) return;
    
    console.log(`[Popup] Setting loading state: ${loading}`, { skipUIUpdate });
    isLoading = loading;
    
    // Update loading indicator visibility
    if (loadingIndicator) {
      loadingIndicator.style.display = loading ? 'block' : 'none';
    }
    
    // Update all buttons
    const buttons = [loginBtn, logoutBtn, summarizeBtn, viewSavedBtn];
    buttons.forEach(btn => {
      if (!btn) return; // Skip if button doesn't exist
      
      if (loading) {
        // When loading starts
        if (!btn.disabled) {
          const originalHTML = btn.innerHTML;
          btn.setAttribute('data-original-html', originalHTML);
          btn.innerHTML = `<span class="loading"></span> ${btn.textContent.trim()}`;
        }
        btn.disabled = true;
      } else {
        // When loading ends
        if (btn.hasAttribute('data-original-html')) {
          btn.innerHTML = btn.getAttribute('data-original-html');
          btn.removeAttribute('data-original-html');
        }
        
        if (!skipUIUpdate) {
          // Only re-enable if it's not supposed to be disabled by default
          const shouldDisable = (btn.id === 'summarizeBtn' || btn.id === 'viewSavedBtn') && 
                              (!currentUser || !currentUser.isAuthenticated);
          btn.disabled = shouldDisable;
        }
      }
    });
    
    // Update UI based on loading state if not skipped
    if (!loading && !skipUIUpdate) {
      if (currentUser?.isAuthenticated) {
        // Use a small timeout to prevent stack overflow
        setTimeout(() => updateUIForLoggedInUser(currentUser, currentUser.token), 0);
      } else {
        // Use a small timeout to prevent stack overflow
        setTimeout(updateUIForLoggedOutUser, 0);
      }
    }
  }
  
  // Show loading state in the UI
  function showLoadingState() {
    console.log('[Popup] Showing loading state');
    
    // Show loading state and hide others
    if (loadingState) loadingState.style.display = 'block';
    if (loadingIndicator) loadingIndicator.style.display = 'block';
    if (unauthenticatedState) unauthenticatedState.style.display = 'none';
    if (authenticatedState) authenticatedState.style.display = 'none';
    
    // Disable buttons while loading
    const buttons = [loginBtn, logoutBtn, summarizeBtn, viewSavedBtn];
    buttons.forEach(btn => {
      if (btn) btn.disabled = true;
    });
    
    // Ensure status message is hidden during loading
    if (statusMessage) {
      statusMessage.style.display = 'none';
      statusMessage.textContent = '';
    }
  }
  
  // Set up message listener for auth state changes
  function setupMessageListener() {
    console.log('[Popup] Setting up message listener');
    
    // Handle incoming messages
    const handleMessage = (message, sender, sendResponse) => {
      console.log('[Popup] Received message:', message);
      
      if (message?.type === 'AUTH_STATE_CHANGED') {
        console.log('[Popup] Auth state changed:', {
          isAuthenticated: message.isAuthenticated,
          user: message.user ? { name: message.user.name, email: message.user.email } : null
        });
        
        try {
          // Handle the auth state change
          if (message.isAuthenticated && message.user) {
            currentUser = message.user;
            updateUIForLoggedInUser(message.user, message.token);
            showStatus('Successfully authenticated!', 'success');
          } else {
            currentUser = null;
            updateUIForLoggedOutUser();
            if (message.error) {
              console.error('[Popup] Auth error:', message.error);
              showStatus(message.error, 'error');
            } else {
              showStatus('You have been signed out', 'info');
            }
          }
          
          // Persist the auth state
          chrome.storage.local.set({
            authState: {
              isAuthenticated: !!message.isAuthenticated,
              user: message.user || null,
              token: message.token || null,
              lastUpdated: Date.now()
            }
          }).catch(error => {
            console.error('[Popup] Failed to persist auth state:', error);
          });
          
          // Send response if this is a sendMessage with callback
          if (sendResponse) {
            sendResponse({ success: true });
          }
          
        } catch (error) {
          console.error('[Popup] Error handling auth state change:', error);
          if (sendResponse) {
            sendResponse({ success: false, error: error.message });
          }
        }
        
        // Return true to indicate we'll respond asynchronously
        return true;
      }
      
      // Return false by default to indicate we're not handling this message
      return false;
    };
    
    // Add the message listener
    chrome.runtime.onMessage.addListener(handleMessage);
    
    // Return cleanup function
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }
  
  // Initialize the popup when the DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
