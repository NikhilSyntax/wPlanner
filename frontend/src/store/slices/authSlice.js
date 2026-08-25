import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../../services/authService';

function mapUserFromApi(user) {
  if (!user) return null;
  if (user.profile) {
    return {
      id: user._id || user.id,
      name: user.profile.name,
      email: user.profile.email,
      instruments: user.profile.instruments || [],
      roles: user.roles,
      approvalStatus: user.approvalStatus,
      isAdmin: user.isAdmin,
      isSubAdmin: !!user.isSubAdmin,
      profilePhotoUrl: user.profilePhotoUrl,
    };
  }
  return {
    id: user.id || user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    instruments: user.instruments || [],
    roles: user.roles,
    approvalStatus: user.approvalStatus,
    isAdmin: user.isAdmin,
    isSubAdmin: !!user.isSubAdmin,
    profilePhotoUrl: user.profilePhotoUrl,
  };
}

export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const data = await authService.login(credentials);
      if (data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.response?.data || 'Login failed'
      );
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const data = await authService.register(userData);
      if (data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
      }
      return data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message ||
          error.response?.data ||
          'Registration failed'
      );
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      return await authService.getCurrentUser();
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || error.response?.data || 'Unauthorized'
      );
    }
  }
);

const hasStoredToken = () =>
  typeof window !== 'undefined' && !!localStorage.getItem('accessToken');

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: hasStoredToken(),
    /** false while validating stored token (getCurrentUser in flight). */
    userLoaded: !hasStoredToken(),
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.userLoaded = true;
      localStorage.removeItem('accessToken');
    },
    clearError: (state) => {
      state.error = null;
    },
    updateUserProfilePhoto: (state, action) => {
      if (state.user) {
        state.user.profilePhotoUrl = action.payload;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.user = mapUserFromApi(action.payload.user);
        state.isAuthenticated = true;
        state.userLoaded = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.user = mapUserFromApi(action.payload.user);
        state.isAuthenticated = true;
        state.userLoaded = true;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.user = mapUserFromApi(action.payload);
        state.isAuthenticated = true;
        state.userLoaded = true;
      })
      .addCase(getCurrentUser.rejected, (state) => {
        state.user = null;
        state.isAuthenticated = false;
        state.userLoaded = true;
        localStorage.removeItem('accessToken');
      });
  },
});

export const { logout, clearError, updateUserProfilePhoto } = authSlice.actions;
export default authSlice.reducer;
