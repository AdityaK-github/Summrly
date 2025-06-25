import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

// Async thunks
export const fetchUserProfile = createAsyncThunk(
  'user/fetchProfile',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await api.get(`/users/id/${userId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch user profile');
    }
  }
);

export const followUser = createAsyncThunk(
  'user/follow',
  async (userId, { rejectWithValue }) => {
    try {
      await api.post(`/users/${userId}/follow`);
      return userId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to follow user');
    }
  }
);

export const unfollowUser = createAsyncThunk(
  'user/unfollow',
  async (userId, { rejectWithValue }) => {
    try {
      await api.delete(`/users/${userId}/follow`);
      return userId;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to unfollow user');
    }
  }
);

export const fetchAllUsers = createAsyncThunk(
  'user/fetchAll',
  async ({ page = 1, limit = 20 }, { rejectWithValue }) => {
    try {
      const response = await api.get(`/users?page=${page}&limit=${limit}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch users');
    }
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
      .addCase(followUser.fulfilled, (state) => {
        if (state.profile) {
          state.profile.followersCount += 1;
          state.profile.isFollowing = true;
        }
      })
      // Unfollow User
      .addCase(unfollowUser.fulfilled, (state) => {
        if (state.profile) {
          state.profile.followersCount = Math.max(0, state.profile.followersCount - 1);
          state.profile.isFollowing = false;
        }
      });
  },
});

export const { clearProfile } = userSlice.actions;
export default userSlice.reducer;
