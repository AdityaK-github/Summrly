import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

// Async thunks
export const createContentItem = createAsyncThunk(
  'content/createContentItem',
  async ({ originalUrl, title, type = 'article', isPublic = true }, { rejectWithValue }) => {
    try {
      const response = await api.post('/contentitems', {
        originalUrl, 
        title, 
        type, 
        isPublic
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create content item');
    }
  }
);
export const fetchUserContent = createAsyncThunk(
  'content/fetchUserContent',
  async ({ userId, page = 1 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/contentitems/user/${userId}?page=${page}`);
      return {
        items: response.data.items,
        page: response.data.page,
        hasMore: response.data.hasMore || (response.data.page < response.data.pages)
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch user content');
    }
  }
);

export const fetchDiscoverContent = createAsyncThunk(
  'content/fetchDiscoverContent',
  async ({ page = 1, limit = 10, type = '' }, { rejectWithValue }) => {
    try {
      const response = await api.get(
        `/content/discover?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch discover content');
    }
  }
);

export const fetchContentById = createAsyncThunk(
  'content/fetchContentById',
  async (contentId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/contentitems/${contentId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch content');
    }
  }
);

export const fetchFeed = createAsyncThunk(
  'content/fetchFeed',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/feed');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch feed');
    }
  }
);

const initialState = {
  userContent: [],
  discoverContent: [],
  currentContent: null,
  loading: false,
  error: null,
  hasMore: true,
  currentPage: 1,
};

// Async thunk for liking content
export const likeContent = createAsyncThunk(
  'content/likeContent',
  async (contentId, { rejectWithValue }) => {
    try {
      const response = await api.post(`/contentitems/${contentId}/like`);
      return { contentId, likes: response.data.likes };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to like content');
    }
  }
);

// Async thunk for unliking content
export const unlikeContent = createAsyncThunk(
  'content/unlikeContent',
  async (contentId, { rejectWithValue }) => {
    try {
      const response = await api.delete(`/contentitems/${contentId}/like`);
      return { contentId, likes: response.data.likes };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to unlike content');
    }
  }
);

// Async thunk for saving content
export const saveContent = createAsyncThunk(
  'content/saveContent',
  async (contentId, { rejectWithValue }) => {
    try {
      await api.post(`/contentitems/${contentId}/save`);
      return contentId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to save content');
    }
  }
);

// Async thunk for unsaving content
export const unsaveContent = createAsyncThunk(
  'content/unsaveContent',
  async (contentId, { rejectWithValue }) => {
    try {
      await api.delete(`/contentitems/${contentId}/save`);
      return contentId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to unsave content');
    }
  }
);

const contentSlice = createSlice({
  name: 'content',
  initialState,
  reducers: {
    clearContent: (state) => {
      state.userContent = [];
      state.discoverContent = [];
      state.currentPage = 1;
      state.hasMore = true;
    },
  },
  extraReducers: (builder) => {
    builder
      // Create content item
      .addCase(createContentItem.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createContentItem.fulfilled, (state, action) => {
        state.loading = false;
        state.userContent.unshift(action.payload);
      })
      .addCase(createContentItem.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch user content
      .addCase(fetchUserContent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserContent.fulfilled, (state, action) => {
        state.loading = false;
        const { items, page, hasMore } = action.payload;
        const safeItems = Array.isArray(items) ? items : [];
        
        if (page === 1) {
          state.userContent = safeItems;
        } else {
          // Append new items, avoiding duplicates
          const existingIds = new Set(state.userContent.map(item => item._id));
          const newItems = safeItems.filter(item => !existingIds.has(item._id));
          state.userContent = [...state.userContent, ...newItems];
        }
        state.currentPage = page;
        state.hasMore = hasMore;
      })
      .addCase(fetchUserContent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      
      // Discover content
      .addCase(fetchDiscoverContent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDiscoverContent.fulfilled, (state, action) => {
        state.loading = false;
        state.discoverContent = [
          ...state.discoverContent,
          ...action.payload.content
        ];
        state.currentPage = action.payload.currentPage;
        state.hasMore = action.payload.hasMore;
      })
      .addCase(fetchDiscoverContent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Fetch content by ID
      .addCase(fetchContentById.fulfilled, (state, action) => {
        state.currentContent = action.payload;
      })
      
      // Fetch feed
      .addCase(fetchFeed.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFeed.fulfilled, (state, action) => {
        state.loading = false;
        state.discoverContent = action.payload;
        state.hasMore = action.payload.length > 0;
      })
      .addCase(fetchFeed.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

// Export all action creators
export const { clearContent } = contentSlice.actions;

export default contentSlice.reducer;
