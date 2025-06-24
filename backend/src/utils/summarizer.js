const Groq = require('groq-sdk');

const groqApiKey = process.env.GROQ_API_KEY;

if (!groqApiKey) {
  console.warn('GROQ_API_KEY not found in environment variables. Summarization will not work.');
}

const groq = groqApiKey? new Groq({ apiKey: groqApiKey }) : null;

const DEFAULT_MODEL = 'llama3-70b-8192';

// Rate limiting variables
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests to respect rate limits
const MAX_CHARS_PER_CHUNK = 20000; // Approx 5000 tokens, leaving room for summary
const CHUNK_OVERLAP = 1000; // Overlap characters to maintain context

/**
 * Generates a summary for the given text using Groq API.
 * @param {string} text The text to summarize.
 * @param {string} model The Groq model to use (e.g., 'llama3-8b-8192', 'mixtral-8x7b-32768').
 * @returns {Promise<string>} A promise that resolves to the generated summary.
 */
// Internal function to summarize a single text chunk
const _summarizeTextChunk = async (text, model, isSummarizingSummaries = false) => {
  if (!groq) {
    throw new Error('Groq SDK not initialized. Check GROQ_API_KEY.');
  }
  if (!text || text.trim().length === 0) {
    return ''; // Return empty summary if input text is empty
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: isSummarizingSummaries 
            ? 'You are an expert summarization assistant. Combine the following set of summaries into a single, coherent, and concise final summary. Ensure it captures the most critical information from all provided summaries. Aim for 2-5 sentences.' 
            : 'You are an expert summarization assistant. Provide a concise, factual summary of the following text. Extract the main arguments and key information. The summary should be between 2 and 5 sentences long and written in a neutral, informative tone.'
        },
        {
          role: 'user',
          content: `Please summarize the following text:\n\n${text}`,
        },
      ],
      model: model,
      temperature: 0.3, // Lower temperature for more factual summaries
      max_tokens: 200,  // Adjust as needed for desired summary length (2-5 sentences)
      top_p: 1,
      stop: null,
      stream: false,
    });

    return chatCompletion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error generating summary with Groq:', error);
    throw new Error(`Failed to generate summary: ${error.message}`);
  }
};

const generateSummary = async (text, model = DEFAULT_MODEL) => {
  if (!groq) {
    throw new Error('Groq SDK not initialized. Check GROQ_API_KEY.');
  }
  
  // Implement rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
  if (!text || text.trim() === '') {
    console.log('Input text is empty, returning empty summary.');
    return '';
  }

  // If text is short enough, summarize directly
  if (text.length <= MAX_CHARS_PER_CHUNK) {
    try {
      return await _summarizeTextChunk(text, model);
    } catch (error) {
      console.error(`Error generating summary for short text: ${error.message}`);
      throw error; // Re-throw to be caught by controller
    }
  }

  // Text is long, so chunk it
  console.log(`Text is long (${text.length} chars). Chunking for summarization.`);
  const chunks = [];
  let currentIndex = 0;
  if (MAX_CHARS_PER_CHUNK <= CHUNK_OVERLAP) {
    throw new Error('MAX_CHARS_PER_CHUNK must be greater than CHUNK_OVERLAP for chunking to proceed.');
  }
  while (currentIndex < text.length) {
    const endIndex = Math.min(currentIndex + MAX_CHARS_PER_CHUNK, text.length);
    chunks.push(text.substring(currentIndex, endIndex));
    if (endIndex === text.length) {
      break;
    }
    currentIndex += (MAX_CHARS_PER_CHUNK - CHUNK_OVERLAP);
  }

  console.log(`Split text into ${chunks.length} chunks.`);
  const chunkSummaries = [];
  for (let j = 0; j < chunks.length; j++) {
    try {
      console.log(`Summarizing chunk ${j + 1} of ${chunks.length}...`);
      const chunkSummary = await _summarizeTextChunk(chunks[j], model);
      chunkSummaries.push(chunkSummary);
    } catch (error) {
      console.error(`Error summarizing chunk ${j + 1}: ${error.message}. Skipping this chunk.`);
      // Optionally, handle this more gracefully, e.g., by returning a partial summary or specific error
    }
  }

  if (chunkSummaries.length === 0) {
    console.error('No summaries could be generated from chunks.');
    return ''; // Or throw an error
  }

  const combinedSummaries = chunkSummaries.join('\n\n');
  console.log('Summarizing the combined chunk summaries...');
  
  try {
    // If combined summaries are also too long, we might need another layer of summarization or truncation.
    // For now, let's assume one level of 'summary of summaries' is enough.
    // A more robust solution might recursively call generateSummary if combinedSummaries is too long.
    if (combinedSummaries.length > MAX_CHARS_PER_CHUNK) {
        console.warn(`Combined summaries are too long (${combinedSummaries.length} chars). Truncating for final summarization.`);
        const truncatedCombinedSummaries = combinedSummaries.substring(0, MAX_CHARS_PER_CHUNK);
        return await _summarizeTextChunk(truncatedCombinedSummaries, model, true);
    }
    return await _summarizeTextChunk(combinedSummaries, model, true);
  } catch (error) {
    console.error(`Error generating final summary from combined summaries: ${error.message}`);
    throw error; // Re-throw
  }
};

module.exports = { generateSummary };
