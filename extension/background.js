// Store auth state in memory
let authState = {
  isAuthenticated: false,
  user: null,
  token: null,
  loading: true
};

// Initialize auth state on startup
chrome.runtime.onStartup.addListener(initializeAuthState);
chrome.runtime.onInstalled.addListener(initializeAuthState);

// Track OAuth state for CSRF protection
let oauthState = null;

// Handle messages from popup, content scripts, and OAuth page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle OAuth result from the callback page
  if (request.type === 'AUTH_RESULT') {
    handleAuthResult(request, sendResponse);
    return true;
  }

  // Handle login request
  if (request.action === 'login') {
    handleLogin()
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Required for async sendResponse
  }
  
  // Handle auth state check
  if (request.action === 'checkAuth') {
    checkAuthState()
      .then(state => sendResponse(state))
      .catch(error => sendResponse({ isAuthenticated: false, error: error.message }));
    return true;
  }
  
  // Handle logout
  if (request.action === 'logout') {
    handleLogout()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  // Handle summarization
  if (request.action === 'summarize') {
    handleSummarize(request.data)
      .then(response => sendResponse(response))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Handle OAuth authentication result
async function handleAuthResult(message, sendResponse) {
  console.log('Handling auth result:', message);
  
  if (message.success && message.token) {
    try {
      // Store the token and update state
      await chrome.storage.local.set({
        authToken: message.token,
        user: message.user || null,
        lastAuth: Date.now()
      });
      
      // Update in-memory state
      authState = {
        isAuthenticated: true,
        token: message.token,
        user: message.user || null,
        loading: false
      };
      
      // Notify all extension components about the auth state change
      notifyAuthStateChange();
      
      console.log('Authentication successful');
      sendResponse({ success: true });
    } catch (error) {
      console.error('Failed to process auth result:', error);
      sendResponse({ success: false, error: 'Failed to process authentication' });
    }
  } else {
    console.error('Authentication failed:', message.error);
    authState.loading = false;
    sendResponse({ success: false, error: message.error || 'Authentication failed' });
  }
}

// Initialize auth state from storage
async function initializeAuthState() {
  console.log('Initializing auth state...');
  authState.loading = true;
  
  try {
    const { authToken, user, lastAuth } = await chrome.storage.local.get([
      'authToken', 
      'user', 
      'lastAuth'
    ]);
    
    console.log('Retrieved from storage:', { hasToken: !!authToken, hasUser: !!user, lastAuth });
    
    if (!authToken) {
      console.log('No auth token found in storage');
      authState = { isAuthenticated: false, user: null, token: null, loading: false };
      return;
    }
    
    // Check if token is expired (older than 1 day)
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (lastAuth && (Date.now() - lastAuth > ONE_DAY)) {
      console.log('Auth token expired, clearing...');
      await chrome.storage.local.remove(['authToken', 'user', 'lastAuth']);
      authState = { isAuthenticated: false, user: null, token: null, loading: false };
      return;
    }
    
    try {
      // Verify the token with the backend
      const response = await fetch('http://localhost:5003/api/users/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        console.log('Successfully verified token with backend');
        
        authState = {
          isAuthenticated: true,
          token: authToken,
          user: userData,
          loading: false
        };
        
        // Update stored user data if needed
        if (JSON.stringify(userData) !== JSON.stringify(user)) {
          await chrome.storage.local.set({ 
            user: userData,
            lastAuth: Date.now()
          });
        }
      } else {
        // Token is invalid, clear it
        console.log('Token verification failed, clearing auth data');
        await chrome.storage.local.remove(['authToken', 'user', 'lastAuth']);
        authState = { isAuthenticated: false, user: null, token: null, loading: false };
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      // If there's a network error, still use the stored token
      // but mark as potentially stale
      authState = {
        isAuthenticated: true,
        token: authToken,
        user: user,
        stale: true,
        loading: false
      };
    }
  } catch (error) {
    console.error('Failed to initialize auth state:', error);
    authState = { isAuthenticated: false, user: null, token: null, loading: false };
  } finally {
    // Notify about the initial auth state
    notifyAuthStateChange();
  }
}

// Check authentication state
async function checkAuthState() {
  // If we already have a valid auth state, return it
  if (authState.isAuthenticated && authState.token) {
    return { ...authState };
  }
  
  // Otherwise, try to initialize from storage
  await initializeAuthState();
  return { ...authState };
}

// Notify all extension components about auth state changes
function notifyAuthStateChange() {
  // Clone the auth state without the loading flag
  const { loading, ...stateToSend } = authState;
  
  console.log('Notifying about auth state change:', stateToSend);
  
  // Send to all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'AUTH_STATE_CHANGED',
          ...stateToSend
        }).catch(() => {
          // Ignore errors for tabs that don't have our content script
        });
      }
    });
  });
  
  // Send to popup and other extension contexts
  chrome.runtime.sendMessage({
    type: 'AUTH_STATE_CHANGED',
    ...stateToSend
  }).catch(error => {
    // Ignore errors when no listeners are available
    if (!error.message.includes('Could not establish connection')) {
      console.error('Failed to notify about auth state change:', error);
    }
  });
}

// Handle login
async function handleLogin() {
  try {
    // Generate a random state for CSRF protection
    oauthState = Math.random().toString(36).substring(2, 15);
    
    // Build the OAuth URL
    const authUrl = new URL('http://localhost:5003/api/auth/google/extension');
    authUrl.searchParams.append('state', oauthState);
    authUrl.searchParams.append('redirect_uri', chrome.runtime.getURL('oauth.html'));
    
    // Open the OAuth URL in a new tab
    const tab = await chrome.tabs.create({ 
      url: authUrl.toString(),
      active: true
    });
    
    return { success: true, tabId: tab.id };
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Handle logout
async function handleLogout() {
  try {
    // Clear stored auth data
    await chrome.storage.local.remove(['authToken', 'user']);
    
    // Update auth state
    authState = {
      isAuthenticated: false,
      user: null,
      token: null
    };
    
    // Notify about the auth state change
    notifyAuthStateChange();
    
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

// Handle summarize request
async function handleSummarize(data) {
  // Check if user is authenticated
  if (!authState.isAuthenticated || !authState.token) {
    throw new Error('Please sign in to save summaries');
  }
  
  // Validate input
  if (!data || !data.url) {
    throw new Error('No URL provided to summarize');
  }
  
  try {
    // Get the page content using the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Execute content script to extract page content
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractPageContent
    });
    
    const pageContent = results[0].result;
    const title = data.title || tab.title || 'Untitled Page';
    
    // Send content to backend for summarization
    const response = await fetch('http://localhost:5003/api/contentitems', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: data.url,
        title: title,
        content: pageContent,
        type: 'article',
        isPublic: false,
        sourceDomain: new URL(data.url).hostname
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to save summary: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    return { 
      success: true, 
      data: result,
      message: 'Page summarized and saved successfully!'
    };
  } catch (error) {
    console.error('Summarization error:', error);
    throw error;
  }
}

// Function to extract page content (runs in page context)
function extractPageContent() {
  // Try to get meaningful content from the page
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content',
    'body'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim().length > 100) {
      return element.textContent.trim();
    }
  }
  
  // Fallback to body content
  return document.body.textContent.trim();
}
