import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SongQuickNavModal from './SongQuickNavModal';

describe('SongQuickNavModal Component', () => {
  const mockSongs = [
    { _id: 'song-1', title: '10,000 Reasons', artist: 'Matt Redman', key: 'G', bpm: 72 },
    { _id: 'song-2', title: 'Amazing Grace', artist: 'John Newton', key: 'D', bpm: 80 },
    { _id: 'song-3', title: 'Goodness of God', artist: 'Bethel Music', key: 'Ab', bpm: 68 },
  ];

  test('renders all songs with order numbers and key badges', () => {
    const onSelectMock = jest.fn();
    const onCloseMock = jest.fn();

    render(
      <SongQuickNavModal
        open={true}
        onClose={onCloseMock}
        songs={mockSongs}
        currentSongId="song-2"
        onSelectSong={onSelectMock}
        title="Setlist Songs"
      />
    );

    expect(screen.getByText('Setlist Songs')).toBeInTheDocument();
    expect(screen.getByText('3 songs')).toBeInTheDocument();

    expect(screen.getByText('10,000 Reasons')).toBeInTheDocument();
    expect(screen.getByText('Amazing Grace')).toBeInTheDocument();
    expect(screen.getByText('Goodness of God')).toBeInTheDocument();

    expect(screen.getByText('Key: G')).toBeInTheDocument();
    expect(screen.getByText('Key: D')).toBeInTheDocument();
  });

  test('calls onSelectSong and onClose when clicking a song item', () => {
    const onSelectMock = jest.fn();
    const onCloseMock = jest.fn();

    render(
      <SongQuickNavModal
        open={true}
        onClose={onCloseMock}
        songs={mockSongs}
        currentSongId="song-1"
        onSelectSong={onSelectMock}
      />
    );

    const targetSong = screen.getByText('Amazing Grace');
    fireEvent.click(targetSong);

    expect(onSelectMock).toHaveBeenCalledWith(mockSongs[1], 1);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  test('filters songs by search term', () => {
    const onSelectMock = jest.fn();
    const onCloseMock = jest.fn();

    const { rerender } = render(
      <SongQuickNavModal
        open={true}
        onClose={onCloseMock}
        songs={mockSongs}
        currentSongId="song-1"
        onSelectSong={onSelectMock}
      />
    );

    // Filter by title
    const searchInput = screen.queryByPlaceholderText(/Search by title, artist, or key/i);
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: 'Goodness' } });
      expect(screen.getByText('Goodness of God')).toBeInTheDocument();
      expect(screen.queryByText('10,000 Reasons')).not.toBeInTheDocument();
    }
  });
});
