const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fetches content from a URL and extracts the main text.
 * @param {string} url The URL to fetch content from.
 * @returns {Promise<string>} A promise that resolves to the extracted text.
 */
const extractTextFromUrl = async (url) => {
  try {
    const { data: htmlContent } = await axios.get(url, {
      headers: {
        // Some websites might block requests without a common user-agent
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000, // 10 seconds timeout
    });

    const $ = cheerio.load(htmlContent);

    // Remove script and style tags to avoid extracting their content
    $('script, style, noscript, iframe, nav, footer, header, aside').remove();

    // Attempt to get text from common content-holding elements
    // This is a basic strategy and might need refinement for different site structures
    let extractedText = '';
    $('article, .article, .post, .content, main, [role="main"]').each((i, elem) => {
      extractedText += $(elem).text().trim() + '\n\n';
    });

    // If no specific content containers found, try to get from body or p tags
    if (!extractedText.trim()) {
        $('p').each((i, elem) => {
            extractedText += $(elem).text().trim() + '\n';
        });
    }
    
    // Fallback to body if still nothing (might be too broad)
    if (!extractedText.trim()) {
        extractedText = $('body').text();
    }

    // Clean up excessive newlines and whitespace
    return extractedText.replace(/\s\s+/g, ' ').replace(/\n\n+/g, '\n\n').trim();

  } catch (error) {
    console.error(`Error fetching or parsing URL ${url}:`, error.message);
    // Consider if specific error types should be handled differently
    if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch content from URL: ${error.message} (Status: ${error.response?.status})`);
    }
    throw new Error(`Error processing URL ${url}: ${error.message}`);
  }
};

module.exports = { extractTextFromUrl };
