import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = 'http://localhost:5003/api';

// Async thunks
export const createContentItem = createAsyncThunk(
  'content/createContentItem',
  async ({ originalUrl, title, type = 'article', isPublic = true }, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const response = await axios.post(
        `${API_URL}/contentitems`,
        { originalUrl, title, type, isPublic },
        {
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create content item');
    }
  }
);
export const fetchUserContent = createAsyncThunk(
  'content/fetchUserContent',
  async ({ userId, page = 1 }, { getState }) => {
    const { token } = getState().auth;
    const response = await axios.get(`${API_URL}/contentitems/user/${userId}?page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return {
      items: response.data.items,
      page: response.data.page,
      hasMore: response.data.hasMore || (response.data.page < response.data.pages)
    };
  }
);

export const fetchDiscoverContent = createAsyncThunk(
  'content/fetchDiscoverContent',
  async ({ page = 1, limit = 10, type = '' }, { getState }) => {
    const { token } = getState().auth;
    const response = await axios.get(
      `${API_URL}/content/discover?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  }
);

export const fetchContentById = createAsyncThunk(
  'content/fetchContentById',
  async (contentId, { getState }) => {
    const { token } = getState().auth;
    const response = await axios.get(
      `${API_URL}/contentitems/${contentId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
  }
);

export const fetchFeed = createAsyncThunk(
  'content/fetchFeed',
  async (_, { getState }) => {
    const { token } = getState().auth;
    const response = await axios.get(
      `${API_URL}/feed`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return response.data;
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
  async (contentId, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const response = await axios.post(
        `${API_URL}/contentitems/${contentId}/like`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return { contentId, likes: response.data.likes };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to like content');
    }
  }
);

// Async thunk for unliking content
export const unlikeContent = createAsyncThunk(
  'content/unlikeContent',
  async (contentId, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      const response = await axios.delete(
        `${API_URL}/contentitems/${contentId}/like`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return { contentId, likes: response.data.likes };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to unlike content');
    }
  }
);

// Async thunk for saving content
export const saveContent = createAsyncThunk(
  'content/saveContent',
  async (contentId, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      await axios.post(
        `${API_URL}/contentitems/${contentId}/save`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return contentId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to save content');
    }
  }
);

// Async thunk for unsaving content
export const unsaveContent = createAsyncThunk(
  'content/unsaveContent',
  async (contentId, { getState, rejectWithValue }) => {
    try {
      const { token } = getState().auth;
      await axios.delete(
        `${API_URL}/contentitems/${contentId}/save`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
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
        if (page === 1) {
          state.userContent = items;
        } else {
          // Append new items, avoiding duplicates
          const existingIds = new Set(state.userContent.map(item => item._id));
          const newItems = items.filter(item => !existingIds.has(item._id));
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
