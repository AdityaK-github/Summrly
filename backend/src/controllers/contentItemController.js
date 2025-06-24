// Placeholder for content item controller logic
const ContentItem = require('../models/contentItemModel');
const asyncHandler = require('express-async-handler'); // For cleaner async error handling
const { extractTextFromUrl } = require('../utils/contentExtractor');
const { generateSummary } = require('../utils/summarizer');
const User = require('../models/userModel'); // Import User model

// @desc    Create a new content item
// @route   POST /api/contentitems
// @access  Private (requires user to be logged in)
const createContentItem = asyncHandler(async (req, res) => {
  const { type, originalUrl, title, summary, thumbnailUrl, tags, isPublic, consumedAt, llmEngineUsed } = req.body;

  // Basic validation for required fields
  if (!type || !originalUrl || !title) {
    res.status(400);
    throw new Error('Please provide type, originalUrl, and title');
  }

  const contentItem = new ContentItem({
    userId: req.user._id, // From protect middleware
    type,
    originalUrl,
    title,
    summary: summary || '', // Default to empty string if not provided
    thumbnailUrl,
    tags: tags || [],
    isPublic: isPublic === undefined ? true : isPublic, // Default to true if not provided
    consumedAt: consumedAt ? new Date(consumedAt) : undefined, // Allow user to specify, else model default
    llmEngineUsed,
  });

    // Attempt to fetch content and generate summary
  if (originalUrl) {
    try {
      console.log(`Attempting to extract text from: ${originalUrl}`);
      const extractedText = await extractTextFromUrl(originalUrl);
      if (extractedText && extractedText.trim().length > 0) {
        console.log('Text extracted successfully. Attempting to generate summary...');
        const intendedLLMModel = 'llama3-70b-8192'; // Using Llama 3 70B model
        const generatedAISummary = await generateSummary(extractedText); // Summarizer now handles chunking
        if (generatedAISummary && generatedAISummary.trim().length > 0) {
          contentItem.summary = generatedAISummary;
          contentItem.llmEngineUsed = intendedLLMModel; // Reflect the model intended/used
          console.log('Summary generated and updated.');

          // Increment user's summariesCreatedCount
          try {
            const user = await User.findById(req.user._id);
            if (user) {
              user.summariesCreatedCount = (user.summariesCreatedCount || 0) + 1;
              await user.save();
              console.log(`User ${user.username}'s summariesCreatedCount incremented to ${user.summariesCreatedCount}`);
            } else {
              console.warn(`User not found for ID: ${req.user._id} when trying to increment summary count.`);
            }
          } catch (userUpdateError) {
            console.error(`Error updating user's summary count: ${userUpdateError.message}`);
            // Non-critical error, proceed with content item creation
          }
        } else {
          console.log('Summary generation returned empty or failed, using provided summary or default.');
        }
      } else {
        console.log('No text could be extracted, or extracted text was empty. Skipping summary generation.');
      }
    } catch (error) {
      console.error(`Error during content extraction or summarization for ${originalUrl}: ${error.message}`);
      // Optionally, you could set a specific error message on the item or log this more formally
      // For now, we'll proceed to save the item without the AI summary if this block fails
    }
  }

  const createdContentItem = await contentItem.save();
  res.status(201).json(createdContentItem);
});

// @desc    Get all content items for the logged-in user
// @route   GET /api/contentitems
// @access  Private
const getContentItems = asyncHandler(async (req, res) => {
  const contentItems = await ContentItem.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json(contentItems);
});

// @desc    Get content items by user ID (public items only unless requesting user's own content)
// @route   GET /api/contentitems/user/:userId
// @access  Public (for public items), Private (for private user content)
const getContentItemsByUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Check if the requesting user is the owner
  const isOwner = req.user && req.user._id.toString() === userId;
  
  let query = { userId };
  
  // If not the owner, only return public items
  if (!isOwner) {
    query.isPublic = true;
  }

  const [items, total] = await Promise.all([
    ContentItem.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'username profilePictureUrl'),
    ContentItem.countDocuments(query)
  ]);

  res.status(200).json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
    hasMore: skip + items.length < total
  });
});

// @desc    Get a single content item by ID
// @route   GET /api/contentitems/:id
// @access  Private (conditionally, based on item ownership if not public)
const getContentItemById = asyncHandler(async (req, res) => {
  const contentItem = await ContentItem.findById(req.params.id);

  if (!contentItem) {
    res.status(404);
    throw new Error('Content item not found');
  }

  // Check if the item is public or if the requesting user is the owner
  if (contentItem.isPublic || (req.user && contentItem.userId.toString() === req.user._id.toString())) {
    res.status(200).json(contentItem);
  } else {
    // If item is private and user is not the owner (or user is not logged in, though 'protect' middleware handles that)
    res.status(404); // Or 403 Forbidden, 404 is often preferred to not reveal existence
    throw new Error('Content item not found or access denied');
  }
});

// @desc    Update a content item
// @route   PUT /api/contentitems/:id
// @access  Private (user must own the item)
const updateContentItem = asyncHandler(async (req, res) => {
  const contentItem = await ContentItem.findById(req.params.id);

  if (!contentItem) {
    res.status(404);
    throw new Error('Content item not found');
  }

  // Check if the logged-in user is the owner of the content item
  if (contentItem.userId.toString() !== req.user._id.toString()) {
    res.status(403); // Forbidden
    throw new Error('User not authorized to update this content item');
  }

  // Fields that can be updated
  const { title, summary, type, originalUrl, thumbnailUrl, tags, isPublic, consumedAt, llmEngineUsed } = req.body;

  contentItem.title = title !== undefined ? title : contentItem.title;
  contentItem.summary = summary !== undefined ? summary : contentItem.summary;
  contentItem.type = type !== undefined ? type : contentItem.type;
  contentItem.originalUrl = originalUrl !== undefined ? originalUrl : contentItem.originalUrl;
  contentItem.thumbnailUrl = thumbnailUrl !== undefined ? thumbnailUrl : contentItem.thumbnailUrl;
  contentItem.tags = tags !== undefined ? tags : contentItem.tags;
  contentItem.isPublic = isPublic !== undefined ? isPublic : contentItem.isPublic;
  contentItem.consumedAt = consumedAt !== undefined ? new Date(consumedAt) : contentItem.consumedAt;
  contentItem.llmEngineUsed = llmEngineUsed !== undefined ? llmEngineUsed : contentItem.llmEngineUsed;
  // Note: userId should not be updatable here
  // sourceDomain is updated by pre-save hook if originalUrl changes

  const updatedContentItem = await contentItem.save();
  res.status(200).json(updatedContentItem);
});

// @desc    Delete a content item
// @route   DELETE /api/contentitems/:id
// @access  Private (user must own the item)
const deleteContentItem = asyncHandler(async (req, res) => {
  const contentItem = await ContentItem.findById(req.params.id);

  if (!contentItem) {
    res.status(404);
    throw new Error('Content item not found');
  }

  // Check if the logged-in user is the owner of the content item
  if (contentItem.userId.toString() !== req.user._id.toString()) {
    res.status(403); // Forbidden
    throw new Error('User not authorized to delete this content item');
  }

  await contentItem.deleteOne(); // Mongoose v6+ uses deleteOne()
  // For older Mongoose versions, it might be contentItem.remove()

  res.status(200).json({ message: 'Content item removed successfully' });
  // Alternatively, send a 204 No Content status:
  // res.status(204).send();
});

module.exports = {
  createContentItem,
  getContentItems,
  getContentItemById,
  updateContentItem,
  deleteContentItem,
};
