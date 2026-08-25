import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../store/slices/authSlice';
import Dashboard from './Dashboard';

const createTestStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer,
      events: () => ({ events: [], loading: false, error: null }),
      ui: () => ({ loading: false, notifications: [] }),
    },
  });
};

describe('Dashboard', () => {
  test('renders welcome message', () => {
    const store = createTestStore();
    render(
      <Provider store={store}>
        <Dashboard />
      </Provider>
    );

    expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
  });
});
