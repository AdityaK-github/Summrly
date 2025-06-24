console.log('[Summrly] Content script loaded');

// Function to extract the main content from the page
function extractPageContent() {
  console.log('[Summrly] Extracting page content');
  // Try to get the main content using common selectors
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.main-content',
    '.post-content',
    '.entry-content',
    '.article-body',
    '.content',
    '#content',
    'body' // Fallback to body if nothing else works
  ];

  // Find the main content element
  let contentElement = null;
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      contentElement = element;
      break;
    }
  }

  if (!contentElement) {
    console.warn('Could not find main content element');
    return { 
      title: document.title || 'Untitled',
      text: document.body.innerText.trim(),
      html: document.documentElement.outerHTML,
      url: window.location.href
    };
  }

  // Clone the element to avoid modifying the original
  const clone = contentElement.cloneNode(true);
  
  // Remove unwanted elements (nav, header, footer, etc.)
  const selectorsToRemove = [
    'nav', 'header', 'footer', 'aside', 'script', 'style', 
    'iframe', 'noscript', 'svg', 'img', 'button', 'form',
    '.nav', '.header', '.footer', '.sidebar', '.ad', '.ads',
    '[role="navigation"]', '[role="banner"]', '[role="complementary"]'
  ];

  selectorsToRemove.forEach(selector => {
    const elements = clone.querySelectorAll(selector);
    elements.forEach(el => el.remove());
  });

  // Get clean text content
  const text = clone.textContent
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .trim();

  return {
    title: document.title || 'Untitled',
    text: text,
    html: clone.innerHTML,
    url: window.location.href,
    timestamp: new Date().toISOString()
  };
}

console.log('[Summrly] Content script initialized');

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Summrly] Received message in content script:', request);
  
  if (request.action === 'extractContent') {
    console.log('[Summrly] Extracting content...');
    
    // Small delay to ensure DOM is fully loaded
    setTimeout(() => {
      try {
        const content = extractPageContent();
        console.log('[Summrly] Content extracted successfully');
        sendResponse({ success: true, content });
      } catch (error) {
        console.error('[Summrly] Error extracting content:', error);
        sendResponse({ 
          success: false, 
          error: error.message,
          stack: error.stack
        });
      }
    }, 100);
    
    // Return true to indicate we'll respond asynchronously
    return true;
  }
  
  // For any other message, don't respond
  return false;
});
