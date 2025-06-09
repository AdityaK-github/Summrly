document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userInfo = document.getElementById('userInfo');
  const userAvatar = document.getElementById('userAvatar');
  const userName = document.getElementById('userName');
  const userEmail = document.getElementById('userEmail');
  const summarizeBtn = document.getElementById('summarizeBtn');
  const statusMessage = document.getElementById('statusMessage');
  const authSection = document.getElementById('authSection');

  // State
  let isLoading = false;

  // Initialize
  checkAuthState();
  setupEventListeners();

  // Event Listeners
  function setupEventListeners() {
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    summarizeBtn.addEventListener('click', handleSummarize);
  }

  // Check authentication state
  async function checkAuthState() {
    try {
      setLoading(true);
      showStatus('Checking authentication status...', 'info');
      
      const authState = await chrome.runtime.sendMessage({ action: 'checkAuth' });
      
      if (authState.isAuthenticated) {
        updateUIForLoggedInUser(authState.user, authState.token);
        showStatus('Welcome back!', 'success');
      } else {
        updateUIForLoggedOutUser();
        if (authState.error) {
          showStatus(authState.error, 'error');
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      updateUIForLoggedOutUser();
      showStatus('Error checking authentication status', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Handle login
  async function handleLogin() {
    try {
      setLoading(true);
      showStatus('Opening Google login...', 'info');
      
      const response = await chrome.runtime.sendMessage({ action: 'login' });
      
      if (response && response.success) {
        showStatus('Please complete login in the new tab', 'info');
        // The popup will update when the auth state changes
      } else {
        throw new Error(response?.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      showStatus(`Error: ${error.message}`, 'error');
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

  // Update UI for logged in user
  function updateUIForLoggedInUser(user, token) {
    userInfo.classList.remove('hidden');
    
    // Update user info
    const displayName = user.name || user.username || 'User';
    userName.textContent = displayName;
    userEmail.textContent = user.email || '';
    userAvatar.textContent = displayName.charAt(0).toUpperCase();
    
    // Update buttons
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    summarizeBtn.disabled = false;
  }

  // Update UI for logged out user
  function updateUIForLoggedOutUser() {
    userInfo.classList.add('hidden');
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    summarizeBtn.disabled = true;
  }

  // Handle summarize action
  async function handleSummarize() {
    if (isLoading) return;
    
    try {
      setLoading(true);
      showStatus('Analyzing page content...', 'info');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = tab.url;
      const title = tab.title || 'Untitled Page';

      if (!url || (!url.startsWith('http:') && !url.startsWith('https:'))) {
        throw new Error('Cannot summarize this page (invalid URL)');
      }

      // Send summarize request to background script
      const response = await chrome.runtime.sendMessage({
        action: 'summarize',
        data: {
          url: url,
          title: title
        }
      });

      if (response && response.success) {
        showStatus('Page summarized and saved successfully!', 'success');
        console.log('Summary saved:', response.data);
      } else {
        throw new Error(response?.error || 'Failed to summarize page');
      }
    } catch (error) {
      console.error('Summarize error:', error);
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  // Show status message
  function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type} visible`;
    
    // Auto-hide after 5 seconds
    clearTimeout(window.statusTimeout);
    window.statusTimeout = setTimeout(() => {
      statusMessage.classList.remove('visible');
    }, 5000);
  }

  // Set loading state
  function setLoading(loading) {
    isLoading = loading;
    const buttons = [loginBtn, logoutBtn, summarizeBtn];
    
    buttons.forEach(btn => {
      if (loading && !btn.classList.contains('hidden')) {
        btn.disabled = true;
        const originalHTML = btn.innerHTML;
        btn.setAttribute('data-original-html', originalHTML);
        btn.innerHTML = `<span class="loading"></span> ${btn.textContent.trim()}`;
      } else if (!loading && btn.hasAttribute('data-original-html')) {
        btn.innerHTML = btn.getAttribute('data-original-html');
        btn.removeAttribute('data-original-html');
        
        // Only re-enable if it's not supposed to be disabled by default
        if (btn.id !== 'summarizeBtn' || !userInfo.classList.contains('hidden')) {
          btn.disabled = false;
        }
      }
    });
  }
  
  // Listen for auth state changes from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'AUTH_STATE_CHANGED') {
      if (message.isAuthenticated) {
        updateUIForLoggedInUser(message.user, message.token);
        showStatus('Successfully signed in!', 'success');
      } else {
        updateUIForLoggedOutUser();
      }
    }
  });
});
