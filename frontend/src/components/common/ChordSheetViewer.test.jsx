import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ChordSheetViewer from './ChordSheetViewer';
import api from '../../services/api';

jest.mock('../../services/api');

describe('ChordSheetViewer Setlist Navigation in Fullscreen Stage Mode', () => {
  const defaultProps = {
    songId: 'song-1',
    song: {
      _id: 'song-1',
      title: 'Amazing Grace',
      artist: 'John Newton',
      key: 'G',
    },
    rawContent: '[G]Amazing grace how [C]sweet the [G]sound',
    originalKey: 'G',
    title: 'Amazing Grace',
    artist: 'John Newton',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: { userPreference: null } });
  });

  test('renders fullscreen top bar and floating navigation with setlist buttons', () => {
    const onPrevMock = jest.fn();
    const onNextMock = jest.fn();

    render(
      <ChordSheetViewer
        {...defaultProps}
        initialFullscreen={true}
        onPrevSong={onPrevMock}
        onNextSong={onNextMock}
        prevSong={{ _id: 'song-0', title: '10,000 Reasons' }}
        nextSong={{ _id: 'song-2', title: 'Goodness of God' }}
        currentIndex={1}
        totalSongs={3}
      />
    );

    // Fullscreen top bar should display song title and counter
    expect(screen.getByText('Amazing Grace')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    // Buttons should be rendered and enabled
    const prevBtn = screen.getByText('Prev');
    const nextBtn = screen.getByText('Next');
    expect(prevBtn).toBeInTheDocument();
    expect(nextBtn).toBeInTheDocument();

    fireEvent.click(prevBtn);
    expect(onPrevMock).toHaveBeenCalledTimes(1);

    fireEvent.click(nextBtn);
    expect(onNextMock).toHaveBeenCalledTimes(1);
  });

  test('disables Prev button on the first song of setlist', () => {
    const onNextMock = jest.fn();

    render(
      <ChordSheetViewer
        {...defaultProps}
        initialFullscreen={true}
        onPrevSong={jest.fn()}
        onNextSong={onNextMock}
        prevSong={null}
        nextSong={{ _id: 'song-2', title: 'Goodness of God' }}
        currentIndex={0}
        totalSongs={3}
      />
    );

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    const prevBtn = screen.getByText('Prev').closest('button');
    expect(prevBtn).toBeDisabled();

    const nextBtn = screen.getByText('Next').closest('button');
    expect(nextBtn).not.toBeDisabled();
  });

  test('disables Next button on the last song of setlist', () => {
    const onPrevMock = jest.fn();

    render(
      <ChordSheetViewer
        {...defaultProps}
        initialFullscreen={true}
        onPrevSong={onPrevMock}
        onNextSong={jest.fn()}
        prevSong={{ _id: 'song-1', title: '10,000 Reasons' }}
        nextSong={null}
        currentIndex={2}
        totalSongs={3}
      />
    );

    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    const prevBtn = screen.getByText('Prev').closest('button');
    expect(prevBtn).not.toBeDisabled();

    const nextBtn = screen.getByText('Next').closest('button');
    expect(nextBtn).toBeDisabled();
  });

  test('handles keyboard shortcuts in fullscreen mode', () => {
    const onPrevMock = jest.fn();
    const onNextMock = jest.fn();

    render(
      <ChordSheetViewer
        {...defaultProps}
        initialFullscreen={true}
        onPrevSong={onPrevMock}
        onNextSong={onNextMock}
        prevSong={{ _id: 'song-0', title: 'Prev Song' }}
        nextSong={{ _id: 'song-2', title: 'Next Song' }}
        currentIndex={1}
        totalSongs={3}
      />
    );

    // PageDown -> Next Song
    fireEvent.keyDown(window, { key: 'PageDown' });
    expect(onNextMock).toHaveBeenCalledTimes(1);

    // PageUp -> Prev Song
    fireEvent.keyDown(window, { key: 'PageUp' });
    expect(onPrevMock).toHaveBeenCalledTimes(1);

    // 'n' key -> Next Song
    fireEvent.keyDown(window, { key: 'n' });
    expect(onNextMock).toHaveBeenCalledTimes(2);

    // 'p' key -> Prev Song
    fireEvent.keyDown(window, { key: 'p' });
    expect(onPrevMock).toHaveBeenCalledTimes(2);
  });

  test('floating side buttons trigger navigation in fullscreen mode', () => {
    const onPrevMock = jest.fn();
    const onNextMock = jest.fn();

    render(
      <ChordSheetViewer
        {...defaultProps}
        initialFullscreen={true}
        onPrevSong={onPrevMock}
        onNextSong={onNextMock}
        prevSong={{ _id: 'song-0', title: 'Prev Song' }}
        nextSong={{ _id: 'song-2', title: 'Next Song' }}
        currentIndex={1}
        totalSongs={3}
      />
    );

    const prevBubble = screen.getByLabelText('Previous song in setlist');
    const nextBubble = screen.getByLabelText('Next song in setlist');

    expect(prevBubble).toBeInTheDocument();
    expect(nextBubble).toBeInTheDocument();

    fireEvent.click(prevBubble);
    expect(onPrevMock).toHaveBeenCalledTimes(1);

    fireEvent.click(nextBubble);
    expect(onNextMock).toHaveBeenCalledTimes(1);
  });

  test('controlled fullscreen mode communicates toggling to parent callback', () => {
    const onFullscreenChangeMock = jest.fn();

    render(
      <ChordSheetViewer
        {...defaultProps}
        isFullscreen={false}
        onFullscreenChange={onFullscreenChangeMock}
      />
    );

    // Click "Fullscreen Stage Mode" button in normal toolbar
    const stageBtn = screen.getByLabelText('Fullscreen Stage Mode');
    fireEvent.click(stageBtn);
    expect(onFullscreenChangeMock).toHaveBeenCalledWith(true);
  });
});
