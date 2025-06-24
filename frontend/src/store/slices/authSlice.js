import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../utils/api';

// Helper function to set auth token in axios headers
const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    localStorage.setItem('summrly_token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('summrly_token');
  }
};

// Async thunk for user login
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password, token }, { rejectWithValue }) => {
    try {
      let response;
      if (token) {
        // Handle OAuth login with token
        response = await api.get('/users/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        return { user: response.data, token };
      } else {
        // Handle email/password login
        response = await api.post('/users/login', { email, password });
        return { user: response.data.user, token: response.data.token };
      }
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

// Async thunk to load user from token
export const loadUser = createAsyncThunk(
  'auth/loadUser',
  async (_, { getState, rejectWithValue, dispatch }) => {
    try {
      const { token } = getState().auth;
      if (!token) {
        return rejectWithValue('No token found');
      }
      
      // Set the auth token in the headers
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      const response = await api.get('/users/profile');
      return response.data;
    } catch (error) {
      // Clear the token on any error
      delete api.defaults.headers.common['Authorization'];
      localStorage.removeItem('summrly_token');
      
      // If it's a 401, clear the auth state
      if (error.response?.status === 401) {
        dispatch(clearAuthState());
      }
      
      return rejectWithValue(
        error.response?.data?.message || 
        error.message || 
        'Failed to load user. Please log in again.'
      );
    }
  }
);

const initialState = {
  user: null,
  token: localStorage.getItem('summrly_token') || null,
  isAuthenticated: false,
  isLoading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // Clear any authentication errors
    clearAuthState: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
      setAuthToken(null);
    },
    // Other reducers...
    loginStart: (state) => {
      state.isLoading = true;
      state.error = null;
    },
    loginSuccess: (state, action) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.token = action.payload.token;
      setAuthToken(action.payload.token);
    },
    loginFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      setAuthToken(null);
    },
    loadUserSuccess: (state, action) => {
      state.isLoading = false;
      state.isAuthenticated = true;
      state.user = action.payload;
    },
    updateProfile: (state, action) => {
      state.user = { ...state.user, ...action.payload };
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = payload.user;
        state.token = payload.token;
        setAuthToken(payload.token);
      })
      .addCase(login.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload || 'Login failed';
        state.token = null;
        state.isAuthenticated = false;
        setAuthToken(null);
      })
      .addCase(loadUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadUser.fulfilled, (state, { payload }) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = payload;
      })
      .addCase(loadUser.rejected, (state, { payload }) => {
        state.isLoading = false;
        state.error = payload || 'Failed to load user';
        state.token = null;
        state.isAuthenticated = false;
        setAuthToken(null);
      });
  },
});

export const {
  logout,
  updateProfile,
  clearError,
  clearAuthState,
  loginStart,
  loginSuccess,
  loginFailure,
  loadUserSuccess
} = authSlice.actions;

export default authSlice.reducer;
