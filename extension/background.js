// Store auth state in memory
let authState = {
  isAuthenticated: false,
  user: null,
  token: null,
  lastUpdated: null,
  loading: true
};

// Check for existing session on startup
chrome.runtime.onStartup.addListener(checkExistingSession);
chrome.runtime.onInstalled.addListener(checkExistingSession);

// Check for existing session by looking for auth cookie
async function checkExistingSession() {
  const MAX_RETRIES = 2;
  const REQUEST_TIMEOUT = 5000; // 5 seconds
  
  async function fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  async function verifyToken(token, isCookie = false) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Background] ${isCookie ? 'Verifying cookie' : 'Verifying stored token'} (attempt ${attempt}/${MAX_RETRIES})`);
        
        const response = await fetchWithTimeout(
          'http://localhost:5003/api/users/me', 
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            credentials: isCookie ? 'include' : 'same-origin'
          },
          REQUEST_TIMEOUT
        );
        
        if (response.ok) {
          const userData = await response.json();
          const user = userData.user || userData;
          
          console.log(`[Background] User authenticated via ${isCookie ? 'cookie' : 'stored token'}:`, user.email);
          
          // Update auth state
          authState = {
            isAuthenticated: true,
            user,
            token,
            lastUpdated: Date.now(),
            loading: false
          };
          
          // Save to storage
          await chrome.storage.local.set({ authState });
          notifyAuthStateChange();
          console.log('[Background] Restored session for user:', user.email);
          return true;
        } else if (response.status === 401) {
          console.log(`[Background] ${isCookie ? 'Cookie' : 'Token'} invalid (HTTP ${response.status})`);
          return false;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        if (attempt === MAX_RETRIES) {
          console.error(`[Background] Failed to verify ${isCookie ? 'cookie' : 'token'} after ${MAX_RETRIES} attempts:`, error);
          throw error;
        }
        console.warn(`[Background] Attempt ${attempt} failed, retrying...`, error);
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    return false;
  }
  
  try {
    console.log('[Background] Checking for existing session...');
    
    // First try to get the JWT cookie from the website
    const cookies = await chrome.cookies.getAll({ 
      url: 'http://localhost:5003',
      name: 'jwt'
    });
    
    const authCookie = cookies[0];
    
    if (authCookie?.value) {
      // Check if cookie is expired
      if (authCookie.expirationDate && authCookie.expirationDate * 1000 < Date.now()) {
        console.log('[Background] JWT cookie has expired');
        await handleLogout();
        return false;
      }
      
      console.log('[Background] Found JWT cookie, verifying...');
      const verified = await verifyToken(authCookie.value, true);
      if (verified) return true;
      
      console.log('[Background] Cookie verification failed, falling back to stored token');
    } else {
      console.log('[Background] No JWT cookie found');
    }
    
    // Check if we have a token in storage
    const { authState: storedAuth } = await chrome.storage.local.get('authState');
    if (storedAuth?.token) {
      console.log('[Background] Found stored token, verifying...');
      try {
        const verified = await verifyToken(storedAuth.token, false);
        if (verified) return true;
        
        console.log('[Background] Stored token invalid, clearing session');
        await handleLogout();
        return false;
      } catch (error) {
        console.error('[Background] Error verifying stored token:', error);
        await handleLogout();
        return false;
      }
    } else {
      console.log('[Background] No stored auth found');
      await handleLogout();
      return false;
    }
  } catch (error) {
    console.error('[Background] Error checking existing session:', error);
    await handleLogout();
    return false;
  }
}

// Track OAuth window ID and tab ID
let oauthWindowId = null;
let oauthTabId = null;

// Initialize auth state on startup
chrome.runtime.onStartup.addListener(initializeAuthState);
chrome.runtime.onInstalled.addListener(initializeAuthState);

// Track OAuth state for CSRF protection
let oauthState = null;

// Listen for messages from the OAuth popup window
chrome.runtime.onConnect.addListener((port) => {
  console.log('Connected to port:', port.name);
  
  port.onMessage.addListener((message) => {
    if (message.type === 'AUTH_SUCCESS' || message.type === 'AUTH_ERROR') {
      handleOAuthMessage(message);
    }
  });
});

// Handle messages from the OAuth popup window
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.type === 'AUTH_SUCCESS' || message.type === 'AUTH_ERROR') {
    handleOAuthMessage(message, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

// Handle OAuth messages from the popup window
function handleOAuthMessage(message, sendResponse) {
  console.log('[Background] Received OAuth message:', message);
  
  try {
    if (!message || !message.type) {
      console.error('[Background] Invalid message format:', message);
      if (sendResponse) {
        sendResponse({ success: false, error: 'Invalid message format' });
      }
      return false;
    }
    if (message.type === 'AUTH_RESULT') {
      // Handle the auth result from the OAuth popup
      handleAuthResult(message, sendResponse);
      return true; // Keep the message channel open for async response
    } else if (message.type === 'CHECK_AUTH') {
      // Return the current auth state
      sendResponse({
        isAuthenticated: authState.isAuthenticated,
        user: authState.user,
        token: authState.token
      });
      return true;
    } else if (message.type === 'AUTH_SUCCESS') {
      // Update auth state
      authState = {
        isAuthenticated: true,
        user: message.user,
        token: message.token,
        loading: false
      };
      
      // Save to storage
      chrome.storage.local.set({ authState });
      
      // Notify all extension components about the auth state change
      notifyAuthStateChange();
      
      if (sendResponse) {
        sendResponse({ success: true });
      }
      return true;
    } else if (message.type === 'AUTH_ERROR') {
      console.error('OAuth error:', message.error);
      if (sendResponse) {
        sendResponse({ success: false, error: message.error });
      }
      return true;
    }
  } catch (error) {
    console.error('Error handling OAuth message:', error);
    if (sendResponse) {
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  return false;
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request);
  
  // Handle OAuth callback
  if (request.type === 'OAUTH_CALLBACK') {
    console.log('[Background] Received OAuth callback:', request.payload);
    
    // Extract token from the callback URL
    const url = new URL(request.payload.url);
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const queryParams = new URLSearchParams(url.search);
    
    // Check for errors first
    const error = hashParams.get('error') || queryParams.get('error');
    if (error) {
      const errorDesc = hashParams.get('error_description') || queryParams.get('error_description') || error;
      console.error('[Background] OAuth error in callback:', { error, description: errorDesc });
      sendResponse({ success: false, error: errorDesc });
      return true; // Keep the message channel open for async response
    }
    
    // Get token from either hash or query params
    const token = hashParams.get('access_token') || queryParams.get('access_token');
    
    if (token) {
      console.log('[Background] Token received, handling auth success...');
      handleAuthSuccess(token)
        .then((user) => {
          console.log('[Background] Auth success, user:', user);
          sendResponse({ success: true, user });
        })
        .catch(error => {
          console.error('[Background] Auth success handler error:', error);
          sendResponse({ success: false, error: error.message });
        });
    } else {
      const errorMsg = 'No access token found in OAuth response';
      console.error('[Background]', errorMsg);
      sendResponse({ success: false, error: errorMsg });
    }
    
    return true; // Keep the message channel open for async response
  }
  
  // Handle login request
  if (request.action === 'login') {
    console.log('[Background] Handling login request...');
    handleLogin()
      .then(result => sendResponse({ success: true, ...result }))
      .catch(error => {
        console.error('[Background] Login error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
  
  // Handle summarization
  if (request.action === 'summarize') {
    console.log('[Background] Handling summarize request:', request);
    
    // Validate request data
    if (!request.data) {
      const errorMsg = 'No data provided for summarization';
      console.error('[Background]', errorMsg);
      sendResponse({ success: false, error: errorMsg });
      return true;
    }
    
    // Add debug info
    console.log('[Background] Summarization data:', {
      url: request.data.url,
      hasTitle: !!request.data.title,
      timestamp: new Date().toISOString()
    });
    
    handleSummarize(request.data)
      .then(response => {
        console.log('[Background] Summarization successful:', response);
        sendResponse({ success: true, ...response });
      })
      .catch(error => {
        console.error('[Background] Summarize error:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Failed to generate summary',
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      });
      
    return true; // Keep the message channel open for async response
  }
  
  // Handle auth state check
  if (request.type === 'CHECK_AUTH') {
    console.log('[Background] Checking auth state...');
    checkExistingSession()
      .then(() => {
        console.log('[Background] Auth state:', {
          isAuthenticated: authState.isAuthenticated,
          user: authState.user ? { email: authState.user.email } : null
        });
        sendResponse({
          isAuthenticated: authState.isAuthenticated,
          user: authState.user,
          token: authState.token
        });
      })
      .catch(error => {
        console.error('[Background] Auth check error:', error);
        sendResponse({ 
          isAuthenticated: false, 
          error: error.message || 'Failed to check authentication status' 
        });
      });
    return true; // Keep the message channel open for async response
  }
  
  // Handle logout
  if (request.type === 'LOGOUT') {
    console.log('[Background] Logging out...');
    handleLogout()
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('[Background] Logout error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
  
  // Default response for unhandled messages
  console.warn('[Background] Unhandled message type:', request.type || request.action);
  sendResponse({ success: false, error: 'Unhandled message type' });
  return true; // Keep the message channel open for async response
});

// Handle OAuth authentication result (legacy, kept for backward compatibility)
async function handleAuthResult(message, sendResponse) {
  console.log('Handling legacy auth result:', message);
  
  // Create a response handler that will be called when we're done
  const respond = (success, error = null) => {
    const response = { success };
    if (error) response.error = error;
    if (sendResponse) sendResponse(response);
    return response;
  };
  
  if (message.success && message.token) {
    try {
      // If we don't have user info, try to fetch it from the backend
      let user = message.user;
      if (!user || !user._id) {
        try {
          const userResponse = await fetch('http://localhost:5003/api/users/me', {
            headers: {
              'Authorization': `Bearer ${message.token}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            user = userData.user || userData; // Handle different response formats
          } else {
            console.error('Failed to fetch user data:', await userResponse.text());
            return respond(false, 'Failed to fetch user profile');
          }
        } catch (err) {
          console.error('Error fetching user data:', err);
          return respond(false, 'Network error while fetching profile');
        }
      }
      
      // Store the token and update state
      await chrome.storage.local.set({
        authToken: message.token,
        user: user,
        lastAuth: Date.now()
      });
      
      // Update in-memory state
      authState = {
        isAuthenticated: true,
        token: message.token,
        user: user,
        loading: false
      };
      
      console.log('Authentication successful, user:', user);
      
      // Notify all extension components about the auth state change
      notifyAuthStateChange();
      
      return respond(true);
    } catch (error) {
      console.error('Failed to process auth result:', error);
      return respond(false, 'Failed to process authentication');
    }
  } else {
    const error = message.error || 'Authentication failed';
    console.error('Authentication failed:', error);
    
    // Clear any partial auth state
    await chrome.storage.local.remove(['authToken', 'user', 'lastAuth']);
    authState = { isAuthenticated: false, user: null, token: null, loading: false };
    notifyAuthStateChange();
    
    return respond(false, error);
  }
}

// Initialize auth state from storage
async function initializeAuthState() {
  console.log('Initializing auth state...');
  authState.loading = true;
  
  try {
    const result = await chrome.storage.local.get(['authToken', 'user', 'lastAuth']);
    const { authToken, user, lastAuth } = result;
    
    console.log('Retrieved from storage:', { 
      hasToken: !!authToken, 
      hasUser: !!user, 
      lastAuth: lastAuth ? new Date(lastAuth).toISOString() : null
    });
    
    if (!authToken) {
      console.log('No auth token found in storage');
      authState = { isAuthenticated: false, user: null, token: null, loading: false };
      return;
    }
    
    // Check if token is expired (older than 1 day)
    const ONE_DAY = 23 * 60 * 60 * 1000; // 23 hours to be safe
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
        
        // Ensure we have a consistent user object structure
        const normalizedUser = userData.user || userData;
        
        authState = {
          isAuthenticated: true,
          token: authToken,
          user: normalizedUser,
          loading: false
        };
        
        // Always update stored user data to ensure it's fresh
        await chrome.storage.local.set({ 
          user: normalizedUser,
          lastAuth: Date.now()
        });
        
        console.log('Auth state initialized with user:', normalizedUser);
      } else {
        // Token is invalid, clear it
        const errorText = await response.text();
        console.log('Token verification failed:', response.status, errorText);
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
      
      console.log('Using potentially stale auth data due to network error');
    }
  } catch (error) {
    console.error('Failed to initialize auth state:', error);
    // Clear storage on error to prevent being stuck in a bad state
    try {
      await chrome.storage.local.clear();
    } catch (e) {
      console.error('Failed to clear storage:', e);
    }
    authState = { isAuthenticated: false, user: null, token: null, loading: false };
  } finally {
    // Notify about the initial auth state
    console.log('Initial auth state:', authState);
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
  try {
    console.log('Notifying about auth state change, current state:', {
      isAuthenticated: authState?.isAuthenticated,
      user: authState?.user ? { name: authState.user.name, email: authState.user.email } : null
    });
    
    // Clone the auth state without internal flags
    const { loading, stale, ...stateToSend } = authState || {};
    
    // Update the browser action icon badge
    if (authState?.isAuthenticated) {
      chrome.action.setBadgeText({ text: '✓' });
      chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    
    // 1. First notify the popup directly
    chrome.runtime.sendMessage({
      type: 'AUTH_STATE_CHANGED',
      ...stateToSend
    }).then(() => {
      console.log('Successfully notified popup about auth state change');
    }).catch(error => {
      // Ignore errors when no listeners are available
      if (!error.message.includes('Could not establish connection')) {
        console.error('Failed to notify popup about auth state change:', error);
      }
    });
    
    // 2. Then notify all tabs (for content scripts)
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('Error querying tabs:', chrome.runtime.lastError);
        return;
      }
      
      tabs.forEach(tab => {
        if (!tab.id) return;
        
        try {
          chrome.tabs.sendMessage(
            tab.id,
            {
              type: 'AUTH_STATE_CHANGED',
              ...stateToSend
            },
            (response) => {
              if (chrome.runtime.lastError) {
                // Ignore errors about closed tabs or no listener
                if (!chrome.runtime.lastError.message.includes('Could not establish connection')) {
                  console.error(`Error notifying tab ${tab.id}:`, chrome.runtime.lastError);
                }
                return;
              }
              console.log(`Successfully notified tab ${tab.id} about auth state change`);
            }
          );
        } catch (error) {
          console.error(`Error in tab ${tab.id} notification:`, error);
        }
      });
    });
    
  } catch (error) {
    console.error('Error in notifyAuthStateChange:', error);
  }
}

// Handle login
async function handleLogin() {
  console.log('[Background] Starting login process...');
  
  // Clear any existing OAuth tab tracking
  if (oauthTabId) {
    try {
      await chrome.tabs.remove(oauthTabId);
    } catch (e) {
      console.warn('Failed to clean up previous OAuth tab:', e);
    }
    oauthTabId = null;
  }
  
  // Clear any existing auth state and OAuth state
  await chrome.storage.local.remove(['authState', 'oauthState']);
  
  return new Promise((resolve, reject) => {
    try {
      console.log('[Background] Inside login promise');
      
      // Generate a secure random state parameter for CSRF protection
      const state = crypto.randomUUID();
      const redirectUri = chrome.identity.getRedirectURL('oauth.html');
      
      // Store the state in local storage with timestamp
      const oauthState = {
        state: state,
        timestamp: Date.now(),
        redirectUri: redirectUri
      };
      
      console.log('[Background] Storing OAuth state:', { 
        ...oauthState, 
        state: '***' + state.slice(-4),
        redirectUri: redirectUri
      });
      
      // Store the state and handle any errors
      chrome.storage.local.set({ oauthState }, async () => {
        if (chrome.runtime.lastError) {
          const error = new Error('Failed to store OAuth state: ' + chrome.runtime.lastError.message);
          console.error('[Background]', error);
          reject(error);
          return;
        }
        
        try {
          // First, try to get the current tab to see if we're on the website
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          let websiteUrl = 'http://localhost:5003';
          
          // If we're already on the website, use the current URL
          if (tab && tab.url && tab.url.includes('localhost:5003')) {
            const url = new URL(tab.url);
            websiteUrl = `${url.protocol}//${url.host}`;
          }
          
          // Construct the OAuth URL with the correct path
          console.log('[Background] Constructing OAuth URL...');
          const authUrl = new URL(`${websiteUrl}/api/users/auth/google`);
          
          // Add required OAuth parameters
          const params = new URLSearchParams();
          params.append('state', state);
          params.append('client_id', 'web');
          params.append('response_type', 'token');
          params.append('scope', 'profile email');
          params.append('redirect_uri', redirectUri);
          params.append('prompt', 'consent');
          params.append('access_type', 'offline');
          
          // Build the full URL
          const authFullUrl = `${authUrl.toString()}?${params.toString()}`;
          
          console.log('[Background] OAuth URL constructed. Opening URL:', 
            authFullUrl.replace(/state=[^&]+/, 'state=***'));
          
          // Use chrome.identity.launchWebAuthFlow for a more seamless experience
          // Store the current tab ID before launching OAuth
          const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          oauthTabId = currentTab?.id;
          
          chrome.identity.launchWebAuthFlow({
            url: authFullUrl,
            interactive: true
          }, async (responseUrl) => {
            // Clear the tab ID when OAuth flow completes
            oauthTabId = null;
            // Clean up the OAuth state
            chrome.storage.local.remove(['oauthState']);
            
            if (chrome.runtime.lastError) {
              const error = new Error('Authentication failed: ' + chrome.runtime.lastError.message);
              console.error('[Background]', error);
              reject(error);
              return;
            }
            
            if (!responseUrl) {
              const error = new Error('Authentication was canceled by user');
              console.log('[Background]', error.message);
              reject(error);
              return;
            }
            
            console.log('[Background] OAuth redirect URL:', responseUrl);
            
            try {
              // Handle both query string and hash fragment responses
              const url = new URL(responseUrl);
              const hashParams = new URLSearchParams(url.hash.substring(1));
              const queryParams = new URLSearchParams(url.search);
              
              // Check for error in response
              const error = hashParams.get('error') || queryParams.get('error');
              if (error) {
                const errorDesc = hashParams.get('error_description') || queryParams.get('error_description') || error;
                console.error('[Background] OAuth error:', { error, description: errorDesc });
                reject(new Error(`Authentication failed: ${errorDesc || error}`));
                return;
              }
              
              // Get token from either hash or query params
              const token = hashParams.get('access_token') || queryParams.get('access_token');
              
              if (!token) {
                const error = new Error('No access token found in response. Response: ' + responseUrl);
                console.error('[Background]', error);
                reject(error);
                return;
              }
              
              // Handle the successful authentication
              try {
                const result = await handleAuthSuccess(token);
                
                // After successful authentication, check if we need to sync with the website
                const cookies = await chrome.cookies.getAll({ 
                  url: 'http://localhost:5003',
                  name: 'jwt'
                });
                
                if (!cookies.length) {
                  console.log('[Background] No website session found, syncing...');
                  // If no cookie found, try to sync with the website
                  await fetch('http://localhost:5003/api/users/me', {
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json'
                    },
                    credentials: 'include'
                  });
                }
                
                resolve(result);
              } catch (authError) {
                console.error('[Background] Error in auth success handler:', authError);
                reject(authError);
              }
              
            } catch (error) {
              console.error('[Background] Error processing OAuth response:', error);
              reject(new Error('Failed to process authentication response: ' + error.message));
            }
          });
          
        } catch (error) {
          console.error('[Background] Error in login flow:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('[Background] Error in handleLogin:', error);
      reject(error);
    }
  });
}

// Helper function to handle successful authentication
async function handleAuthSuccess(token) {
  console.log('[Background] Authentication successful, fetching user info...');
  
  try {
    // Fetch user info using the token
    const response = await fetch('http://localhost:5003/api/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include' // Include cookies in the request
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user info: ${response.status} ${response.statusText}`);
    }
    
    const userData = await response.json();
    const user = userData.user || userData;
    
    // Update auth state
    const authState = {
      isAuthenticated: true,
      user: user,
      token: token,
      lastUpdated: Date.now(),
      loading: false
    };
    
    // Save to storage
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ authState }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error('Failed to save auth state: ' + chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
    
    // Store the token in the extension's storage for future use
    await chrome.storage.local.set({ 'jwt_token': token });
    
    // Get the JWT cookie from the website
    const cookies = await chrome.cookies.getAll({ 
      url: 'http://localhost:5003',
      name: 'jwt'
    });
    
    const authCookie = cookies[0];
    
    if (authCookie && authCookie.value) {
      console.log('[Background] Successfully synced auth cookie with website');
    } else {
      console.log('[Background] No auth cookie found after login, but continuing with token auth');
    }
    
    // Notify all components about the auth state change
    notifyAuthStateChange();
    
    console.log('[Background] User authenticated successfully:', user.email);
    return { success: true, user };
    
  } catch (error) {
    console.error('[Background] Error in handleAuthSuccess:', error);
    // Clear auth state on error
    await handleLogout();
    throw error;
  }
}

// Handle logout
async function handleLogout() {
  try {
    console.log('[Background] Handling logout...');
    
    // Clear auth state
    authState = {
      isAuthenticated: false,
      user: null,
      token: null,
      lastUpdated: null,
      loading: false
    };
    
    // Clear storage
    await chrome.storage.local.remove(['authState', 'jwt_token']);
    
    try {
      // Try to log out from the website as well
      const response = await fetch('http://localhost:5003/api/users/logout', {
        method: 'POST',
        credentials: 'include' // Important for cookies
      });
      
      if (response.ok) {
        console.log('[Background] Successfully logged out from website');
      } else {
        console.log('[Background] Failed to log out from website, but continuing');
      }
    } catch (error) {
      console.error('[Background] Error during website logout:', error);
      // Continue even if website logout fails
    }
    
    // Clear any remaining cookies
    try {
      const cookies = await chrome.cookies.getAll({ domain: 'localhost' });
      for (const cookie of cookies) {
        if (cookie.name === 'jwt' || cookie.name === 'connect.sid') {
          await chrome.cookies.remove({
            url: `http://${cookie.domain}${cookie.path}`,
            name: cookie.name
          });
        }
      }
    } catch (error) {
      console.error('[Background] Error clearing cookies:', error);
    }
    
    // Notify all components about the auth state change
    notifyAuthStateChange();
    
    console.log('[Background] Logout completed');
    
  } catch (error) {
    console.error('[Background] Error during logout:', error);
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
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    // Send message to content script to extract the page content
    const contentResponse = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tab.id, 
        { action: 'extractContent' },
        {}, // No options
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
    
    if (!contentResponse || !contentResponse.success) {
      throw new Error(contentResponse?.error || 'Failed to extract page content');
    }
    
    const { content } = contentResponse;
    const title = data.title || content.title || tab.title || 'Untitled Page';
    
    console.log('Sending content to backend for summarization:', {
      url: data.url,
      title,
      contentLength: content.text.length,
      sourceDomain: new URL(data.url).hostname
    });
    
    // Send content to backend for summarization
    const response = await fetch('http://localhost:5003/api/contentitems', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authState.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        url: data.url,
        title: title,
        content: content.text,
        type: 'article',
        isPublic: false,
        sourceDomain: new URL(data.url).hostname,
        metadata: {
          extractedAt: content.timestamp,
          contentLength: content.text.length,
          source: 'browser-extension'
        }
      })
    });
    
    if (!response.ok) {
      let errorMessage = `Failed to save summary: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (e) {
        console.error('Error parsing error response:', e);
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    console.log('Successfully saved summary:', result);
    
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
