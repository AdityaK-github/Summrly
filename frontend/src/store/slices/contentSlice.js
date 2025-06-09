import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = 'http://localhost:5003/api';

// Async thunks
export const fetchUserContent = createAsyncThunk(
  'content/fetchUserContent',
  async (_, { getState }) => {
    const { token } = getState().auth;
    const response = await axios.get(`${API_URL}/content/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
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

const initialState = {
  userContent: [],
  discoverContent: [],
  loading: false,
  error: null,
  hasMore: true,
  currentPage: 1,
};

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
      .addCase(fetchUserContent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserContent.fulfilled, (state, action) => {
        state.loading = false;
        state.userContent = action.payload;
      })
      .addCase(fetchUserContent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      .addCase(fetchDiscoverContent.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDiscoverContent.fulfilled, (state, action) => {
        state.loading = false;
        state.discoverContent = [...state.discoverContent, ...action.payload.items];
        state.hasMore = action.payload.pages > action.payload.page;
        state.currentPage = action.payload.page;
      })
      .addCase(fetchDiscoverContent.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      });
  },
});

export const { clearContent } = contentSlice.actions;
export default contentSlice.reducer;
