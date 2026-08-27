import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import eventReducer from './slices/eventSlice';
import teamReducer from './slices/teamSlice';
import uiReducer from './slices/uiSlice';
import autoScheduleReducer from './slices/autoScheduleSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    events: eventReducer,
    teams: teamReducer,
    ui: uiReducer,
    autoSchedules: autoScheduleReducer,
  },
});
