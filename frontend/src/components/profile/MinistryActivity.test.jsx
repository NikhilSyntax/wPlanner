import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import api from '../../services/api';
import MinistryActivity from './MinistryActivity';

jest.mock('../../services/api');

describe('MinistryActivity Component', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading skeleton initially', () => {
    api.get.mockReturnValue(new Promise(() => {})); // pending promise
    render(<MinistryActivity />);
    expect(screen.getByText('Ministry Activity')).toBeInTheDocument();
  });

  test('renders populated ministry statistics, served count, and history correctly', async () => {
    const mockData = {
      served: 42,
      upcomingAssignments: 3,
      servingHistory: [
        {
          eventId: 'ev-1',
          title: 'Sunday Worship',
          startTime: '2026-08-23T10:30:00.000Z',
          endTime: '2026-08-23T12:00:00.000Z',
          timezone: 'UTC',
          team: 'Worship Team',
          position: 'Guitar',
        },
        {
          eventId: 'ev-2',
          title: 'Youth Service',
          startTime: '2026-08-16T17:00:00.000Z',
          endTime: '2026-08-16T19:00:00.000Z',
          timezone: 'UTC',
          team: 'Worship Team',
          position: 'Guitar',
        },
      ],
      positionBreakdown: [
        { position: 'Guitar', count: 24 },
        { position: 'Keys', count: 10 },
        { position: 'Vocals', count: 8 },
      ],
      teamBreakdown: [
        { team: 'Worship Team', count: 35 },
        { team: 'Media Team', count: 7 },
      ],
      pagination: {
        total: 42,
        page: 1,
        limit: 10,
        hasMore: true,
      },
    };

    api.get.mockResolvedValueOnce({ data: mockData });

    render(<MinistryActivity />);

    await waitFor(() => {
      // Primary statistic: "Served", "42", "Times"
      expect(screen.getByText('SERVED')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('Times')).toBeInTheDocument();

      // Secondary statistic: "Upcoming", "3", "Assignments"
      expect(screen.getByText('UPCOMING')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Assignments')).toBeInTheDocument();

      // History
      expect(screen.getByText('Sunday Worship')).toBeInTheDocument();
      expect(screen.getByText('Youth Service')).toBeInTheDocument();
      expect(screen.getByText('Load More')).toBeInTheDocument();

      // Breakdowns
      expect(screen.getByText('Guitar')).toBeInTheDocument();
      expect(screen.getByText('24 Times')).toBeInTheDocument();
      expect(screen.getByText('Keys')).toBeInTheDocument();
      expect(screen.getByText('10 Times')).toBeInTheDocument();
      expect(screen.getByText('Vocals')).toBeInTheDocument();
      expect(screen.getByText('8 Times')).toBeInTheDocument();

      expect(screen.getByText('Teams Served')).toBeInTheDocument();
      expect(screen.getByText('35 Times')).toBeInTheDocument();
      expect(screen.getByText('7 Times')).toBeInTheDocument();
    });
  });

  test('renders friendly empty state when user has 0 served services', async () => {
    const emptyData = {
      served: 0,
      upcomingAssignments: 0,
      servingHistory: [],
      positionBreakdown: [],
      teamBreakdown: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
        hasMore: false,
      },
    };

    api.get.mockResolvedValueOnce({ data: emptyData });

    render(<MinistryActivity />);

    await waitFor(() => {
      expect(screen.getAllByText('0')).toHaveLength(2);
      expect(screen.getByText('No serving history yet.')).toBeInTheDocument();
      expect(
        screen.getByText('Your completed services will appear here.')
      ).toBeInTheDocument();
    });
  });

  test('renders error state and handles retry button', async () => {
    api.get.mockRejectedValueOnce(new Error('Network error'));

    render(<MinistryActivity />);

    await waitFor(() => {
      expect(
        screen.getByText('Unable to load ministry activity. Please try again.')
      ).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    // Mock successful retry
    api.get.mockResolvedValueOnce({
      data: {
        served: 5,
        upcomingAssignments: 1,
        servingHistory: [],
        positionBreakdown: [],
        teamBreakdown: [],
      },
    });

    fireEvent.click(screen.getByText('Try Again'));

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });
});
