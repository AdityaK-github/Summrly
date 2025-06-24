import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = 'http://localhost:5003/api';

// Async thunks
export const fetchUserProfile = createAsyncThunk(
  'user/fetchProfile',
  async (userId, { getState }) => {
    const { token } = getState().auth;
    const response = await axios.get(`${API_URL}/users/id/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }
);

export const followUser = createAsyncThunk(
  'user/follow',
  async (userId, { getState }) => {
    const { token } = getState().auth;
    await axios.post(
      `${API_URL}/users/${userId}/follow`,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return userId;
  }
);

export const unfollowUser = createAsyncThunk(
  'user/unfollow',
  async (userId, { getState }) => {
    const { token } = getState().auth;
    await axios.delete(`${API_URL}/users/${userId}/follow`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return userId;
  }
);

export const fetchAllUsers = createAsyncThunk(
  'user/fetchAll',
  async ({ page = 1, limit = 20 }, { getState }) => {
    const { token } = getState().auth;
    const response = await axios.get(`${API_URL}/users?page=${page}&limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  }
);

const initialState = {
  profile: null,
  allUsers: [],
  totalUsers: 0,
  loading: false,
  error: null,
  following: [],
  followers: [],
  currentPage: 1,
  totalPages: 1,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearProfile: (state) => {
      state.profile = null;
      state.loading = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch All Users
      .addCase(fetchAllUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAllUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.allUsers = action.payload.users;
        state.totalUsers = action.payload.total;
        state.currentPage = action.payload.page;
        state.totalPages = action.payload.pages;
      })
      .addCase(fetchAllUsers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Fetch User Profile
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload.user;
        state.following = action.payload.following || [];
        state.followers = action.payload.followers || [];
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Follow User
      .addCase(followUser.fulfilled, (state, action) => {
        if (state.profile) {
          state.profile.followersCount += 1;
          state.profile.isFollowing = true;
        }
      })
      // Unfollow User
      .addCase(unfollowUser.fulfilled, (state, action) => {
        if (state.profile) {
          state.profile.followersCount = Math.max(0, state.profile.followersCount - 1);
          state.profile.isFollowing = false;
        }
      });
  },
});

export const { clearProfile } = userSlice.actions;
export default userSlice.reducer;
