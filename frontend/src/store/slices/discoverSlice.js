import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

// Async thunks
export const fetchDiscoverContent = createAsyncThunk(
  'discover/fetchContent',
  async ({ page = 1, limit = 10, type = '' }, { rejectWithValue }) => {
    try {
      const response = await api.get(
        `/content/discover?page=${page}&limit=${limit}${type ? `&type=${type}` : ''}`
      );
      return {
        items: response.data.items,
        page: response.data.page,
        pages: response.data.pages,
        total: response.data.total
      };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch discover content');
    }
  }
);

export const searchUsers = createAsyncThunk(
  'discover/searchUsers',
  async ({ query, page = 1, limit = 10 }, { rejectWithValue }) => {
    try {
      const response = await api.get(
        `/users/search?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to search users');
    }
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
  userSearchPerformed: false,
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
      state.userSearchPerformed = false;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    clearUserSearch: (state) => {
      state.users = [];
      state.userSearchLoading = false;
      state.hasMoreUsers = true;
      state.currentUserPage = 1;
      state.userSearchPerformed = false;
      state.searchQuery = '';
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
      .addCase(searchUsers.pending, (state, { meta }) => {
        state.userSearchLoading = true;
        state.error = null;
        state.userSearchPerformed = true;
        // If it's a new search (page 1), clear existing users
        if (meta.arg.page === 1) {
          state.users = [];
        }
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
        state.userSearchPerformed = true;
      })
      .addCase(searchUsers.rejected, (state, action) => {
        state.userSearchLoading = false;
        state.error = action.error.message || 'Failed to search users';
        state.userSearchPerformed = true;
      });
  },
});

export const { clearDiscoverState, setSearchQuery, clearUserSearch } = discoverSlice.actions;
export default discoverSlice.reducer;
