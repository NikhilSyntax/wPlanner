import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';

// ─── Async Thunks ──────────────────────────────────────────────────────────

export const fetchAutoSchedules = createAsyncThunk(
  'autoSchedules/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.get('/auto-schedules');
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch schedules');
    }
  }
);

export const createAutoSchedule = createAsyncThunk(
  'autoSchedules/create',
  async (scheduleData, { rejectWithValue }) => {
    try {
      const res = await api.post('/auto-schedules', scheduleData);
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create schedule');
    }
  }
);

export const updateAutoSchedule = createAsyncThunk(
  'autoSchedules/update',
  async ({ id, data }, { rejectWithValue }) => {
    try {
      const res = await api.put(`/auto-schedules/${id}`, data);
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update schedule');
    }
  }
);

export const toggleAutoSchedule = createAsyncThunk(
  'autoSchedules/toggle',
  async (id, { rejectWithValue }) => {
    try {
      const res = await api.patch(`/auto-schedules/${id}/toggle`);
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to toggle schedule');
    }
  }
);

export const deleteAutoSchedule = createAsyncThunk(
  'autoSchedules/delete',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/auto-schedules/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete schedule');
    }
  }
);

export const runSchedulerNow = createAsyncThunk(
  'autoSchedules/runNow',
  async (_, { rejectWithValue }) => {
    try {
      const res = await api.post('/auto-schedules/run-now');
      return res.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to run scheduler');
    }
  }
);

// ─── Slice ─────────────────────────────────────────────────────────────────

const autoScheduleSlice = createSlice({
  name: 'autoSchedules',
  initialState: {
    schedules: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchAutoSchedules.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAutoSchedules.fulfilled, (state, action) => {
        state.loading = false;
        state.schedules = action.payload;
      })
      .addCase(fetchAutoSchedules.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Create
      .addCase(createAutoSchedule.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createAutoSchedule.fulfilled, (state, action) => {
        state.loading = false;
        state.schedules.unshift(action.payload);
      })
      .addCase(createAutoSchedule.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update
      .addCase(updateAutoSchedule.fulfilled, (state, action) => {
        state.schedules = state.schedules.map((s) =>
          s._id === action.payload._id ? action.payload : s
        );
      })
      .addCase(updateAutoSchedule.rejected, (state, action) => {
        state.error = action.payload;
      })
      // Toggle
      .addCase(toggleAutoSchedule.fulfilled, (state, action) => {
        state.schedules = state.schedules.map((s) =>
          s._id === action.payload._id ? action.payload : s
        );
      })
      // Delete
      .addCase(deleteAutoSchedule.fulfilled, (state, action) => {
        state.schedules = state.schedules.filter((s) => s._id !== action.payload);
      })
      // Run now
      .addCase(runSchedulerNow.pending, (state) => {
        state.loading = true;
      })
      .addCase(runSchedulerNow.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(runSchedulerNow.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearError } = autoScheduleSlice.actions;
export default autoScheduleSlice.reducer;
