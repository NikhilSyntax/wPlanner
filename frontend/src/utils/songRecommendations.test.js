import {
  getRecommendedSongs,
  getKeyRelationScore,
  getLastUsedTimestamp,
  normalizeKey,
} from './songRecommendations';

describe('songRecommendations utility', () => {
  const mockSongs = [
    {
      _id: 'song1',
      title: 'Amazing Grace',
      key: 'G',
      usage: { lastPerformed: '2026-08-01T00:00:00.000Z', timesPerformed: 5 },
    },
    {
      _id: 'song2',
      title: 'How Great Thou Art',
      key: 'G',
      usage: { lastPerformed: '2025-01-01T00:00:00.000Z', timesPerformed: 3 },
    },
    {
      _id: 'song3',
      title: '10,000 Reasons',
      key: 'G',
      usage: { lastPerformed: '2024-05-01T00:00:00.000Z', timesPerformed: 2 },
    },
    {
      _id: 'song4',
      title: 'Way Maker',
      key: 'C',
      usage: { lastPerformed: '2026-07-01T00:00:00.000Z', timesPerformed: 4 },
    },
    {
      _id: 'song5',
      title: 'Cornerstone',
      key: 'C',
      usage: { lastPerformed: '2023-01-01T00:00:00.000Z', timesPerformed: 1 },
    },
    {
      _id: 'song6',
      title: 'Old Forgotten Hymn',
      key: 'D',
      usage: { lastPerformed: '2022-01-01T00:00:00.000Z', timesPerformed: 1 },
    },
    {
      _id: 'song7',
      title: 'Brand New Song',
      key: 'E',
      usage: { lastPerformed: null, timesPerformed: 0 }, // Never performed
    },
  ];

  test('normalizes key correctly', () => {
    expect(normalizeKey('C')).toBe('C');
    expect(normalizeKey('c#')).toBe('C#');
    expect(normalizeKey('Db')).toBe('C#');
    expect(normalizeKey('Eb')).toBe('D#');
    expect(normalizeKey('Bb')).toBe('A#');
    expect(normalizeKey('Am')).toBe('A');
  });

  test('calculates key relation score in range -2 to +2 semitones from original key', () => {
    const setlistKeys = new Set(['G']);
    // Exact match (0 semitones) -> score 5
    expect(getKeyRelationScore('G', setlistKeys)).toBe(5);
    // +1 semitone (G# is 1 half-step up from G) -> score 4
    expect(getKeyRelationScore('G#', setlistKeys)).toBe(4);
    // -1 semitone (F# is 1 half-step down from G) -> score 3
    expect(getKeyRelationScore('F#', setlistKeys)).toBe(3);
    // +2 semitones (A is 2 half-steps up from G) -> score 2
    expect(getKeyRelationScore('A', setlistKeys)).toBe(2);
    // -2 semitones (F is 2 half-steps down from G) -> score 1
    expect(getKeyRelationScore('F', setlistKeys)).toBe(1);
    // Keys outside -2 to +2 range -> score 0
    expect(getKeyRelationScore('C', setlistKeys)).toBe(0);
    expect(getKeyRelationScore('D', setlistKeys)).toBe(0);
    expect(getKeyRelationScore('D#', setlistKeys)).toBe(0);
    expect(getKeyRelationScore('E', setlistKeys)).toBe(0);
    expect(getKeyRelationScore('A#', setlistKeys)).toBe(0);
    expect(getKeyRelationScore('B', setlistKeys)).toBe(0);
  });

  test('recommends at most 3 songs', () => {
    const recs = getRecommendedSongs({
      songs: mockSongs,
      setlist: [{ _id: 'setlist_song', key: 'G' }],
    });
    expect(recs.length).toBeLessThanOrEqual(3);
    expect(recs.length).toBe(3);
  });

  test('selects 2 key-matched songs and 1 long-time-not-used song', () => {
    const recs = getRecommendedSongs({
      songs: mockSongs,
      setlist: [{ _id: 'setlist_song', key: 'G' }],
    });

    expect(recs.length).toBe(3);

    // 2 should be key-matched (Key G)
    const keySongs = recs.filter((r) => r._recType === 'key');
    expect(keySongs.length).toBe(2);
    expect(keySongs.every((s) => s.key === 'G')).toBe(true);

    // 1 should be the oldest / never performed song (song7 - Brand New Song)
    const oldSong = recs.find((r) => r._recType === 'longTime');
    expect(oldSong).toBeDefined();
    expect(oldSong._id).toBe('song7');
    expect(oldSong._recReason).toBe('Never performed');
  });

  test('does not recommend songs already in setlist', () => {
    const recs = getRecommendedSongs({
      songs: mockSongs,
      setlist: [
        { _id: 'song2', key: 'G' },
        { _id: 'song3', key: 'G' },
      ],
    });

    const ids = recs.map((r) => r._id);
    expect(ids).not.toContain('song2');
    expect(ids).not.toContain('song3');
    expect(recs.length).toBe(3);
  });

  test('handles empty setlist by recommending 3 least recently used songs', () => {
    const recs = getRecommendedSongs({
      songs: mockSongs,
      setlist: [],
    });

    expect(recs.length).toBe(3);
    // Oldest/never performed songs should come first
    expect(recs[0]._id).toBe('song7'); // Never performed (timestamp 0)
    expect(recs[1]._id).toBe('song6'); // 2022
    expect(recs[2]._id).toBe('song5'); // 2023
  });

  test('backfills to 3 songs when only 1 key match exists in -2 to +2 range', () => {
    const singleKeyBank = [
      {
        _id: 'k1',
        title: 'Only Key Match',
        key: 'F#', // offset 0 (score 5)
        usage: { lastPerformed: '2026-01-01' },
      },
      {
        _id: 'o1',
        title: 'Old Song 1',
        key: 'C', // offset +6 (score 0)
        usage: { lastPerformed: null },
      },
      {
        _id: 'o2',
        title: 'Old Song 2',
        key: 'D', // offset +8 (score 0)
        usage: { lastPerformed: '2020-01-01' },
      },
      {
        _id: 'o3',
        title: 'Recent Song',
        key: 'A#', // offset +4 (score 0)
        usage: { lastPerformed: '2026-05-01' },
      },
    ];

    const recs = getRecommendedSongs({
      songs: singleKeyBank,
      setlist: [{ _id: 's_fsharp', key: 'F#' }],
    });

    expect(recs.length).toBe(3);
    expect(recs[0]._id).toBe('k1'); // Key match (offset 0)
    expect(recs[1]._id).toBe('o1'); // Never used (Step 2)
    expect(recs[2]._id).toBe('o2'); // Used in 2020 (Step 3 backfill)
  });

  test('filters recommendations by songQuery', () => {
    const recs = getRecommendedSongs({
      songs: mockSongs,
      setlist: [{ _id: 's1', key: 'G' }],
      songQuery: 'Grace',
    });

    expect(recs.length).toBe(1);
    expect(recs[0].title).toBe('Amazing Grace');
  });
});
