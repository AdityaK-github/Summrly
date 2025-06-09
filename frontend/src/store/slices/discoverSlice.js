import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = 'http://localhost:5003/api';

// Async thunks
export const fetchDiscoverContent = createAsyncThunk(
  'discover/fetchContent',
  async ({ page = 1, limit = 10, type = '' }, { getState }) => {
    const { token } = getState().auth;
    const response = await axios.get(
      `${API_URL}/content/discover?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`,
      {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      }
    );
    return response.data;
  }
);

export const searchUsers = createAsyncThunk(
  'discover/searchUsers',
  async ({ query, page = 1, limit = 10 }, { getState }) => {
    const { token } = getState().auth;
    const response = await axios.get(
      `${API_URL}/users/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
      {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
        },
      }
    );
    return response.data;
  }
);

const initialState = {
  content: [],
  users: [],
  loading: false,
  contentLoading: false,
  userSearchLoading: false,
  error: null,
  hasMoreContent: true,
  hasMoreUsers: true,
  currentContentPage: 1,
  currentUserPage: 1,
  searchQuery: '',
};

const discoverSlice = createSlice({
  name: 'discover',
  initialState,
  reducers: {
    clearDiscoverState: (state) => {
      state.content = [];
      state.users = [];
      state.loading = false;
      state.error = null;
      state.hasMoreContent = true;
      state.hasMoreUsers = true;
      state.currentContentPage = 1;
      state.currentUserPage = 1;
      state.searchQuery = '';
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Fetch Discover Content
    builder
      .addCase(fetchDiscoverContent.pending, (state) => {
        state.contentLoading = true;
        state.error = null;
      })
      .addCase(fetchDiscoverContent.fulfilled, (state, action) => {
        state.contentLoading = false;
        const { items, page, pages } = action.payload;
        
        if (page === 1) {
          state.content = items;
        } else {
          // Filter out duplicates before adding new items
          const existingIds = new Set(state.content.map(item => item._id));
          const newItems = items.filter(item => !existingIds.has(item._id));
          state.content = [...state.content, ...newItems];
        }
        
        state.hasMoreContent = pages > page;
        state.currentContentPage = page;
      })
      .addCase(fetchDiscoverContent.rejected, (state, action) => {
        state.contentLoading = false;
        state.error = action.error.message || 'Failed to fetch content';
      })
      
      // Search Users
      .addCase(searchUsers.pending, (state) => {
        state.userSearchLoading = true;
        state.error = null;
      })
      .addCase(searchUsers.fulfilled, (state, action) => {
        state.userSearchLoading = false;
        const { users, page, pages } = action.payload;
        
        if (page === 1) {
          state.users = users;
        } else {
          // Filter out duplicates before adding new users
          const existingIds = new Set(state.users.map(user => user._id));
          const newUsers = users.filter(user => !existingIds.has(user._id));
          state.users = [...state.users, ...newUsers];
        }
        
        state.hasMoreUsers = pages > page;
        state.currentUserPage = page;
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.userSearchLoading = false;
        state.error = action.error.message || 'Failed to search users';
      });
  },
});

export const { clearDiscoverState, setSearchQuery } = discoverSlice.actions;
export default discoverSlice.reducer;
