import {
  fuzzySearchSongs,
  calculateSongMatchScore,
  levenshteinSimilarity,
  normalizeSearchString,
} from './fuzzySearch';

describe('fuzzySearch utility', () => {
  const mockLibrary = [
    { _id: '1', title: 'Amazing Grace', artist: 'John Newton', key: 'G' },
    { _id: '2', title: 'How Great Thou Art', artist: 'Stuart Hine', key: 'A' },
    { _id: '3', title: '10,000 Reasons (Bless The Lord)', artist: 'Matt Redman', key: 'G' },
    { _id: '4', title: 'Way Maker', artist: 'Sinach', key: 'C' },
    { _id: '5', title: 'Goodness of God', artist: 'Bethel Music', key: 'Ab' },
    { _id: '6', title: 'Cornerstone', artist: 'Hillsong Worship', key: 'C' },
    { _id: '7', title: 'What A Beautiful Name', artist: 'Hillsong', key: 'D' },
  ];

  test('normalizes string removing punctuation and extra spaces', () => {
    expect(normalizeSearchString('10,000 Reasons!')).toBe('10000 reasons');
    expect(normalizeSearchString('  Way  Maker  ')).toBe('way maker');
  });

  test('calculates Levenshtein similarity', () => {
    expect(levenshteinSimilarity('amazing', 'amazing')).toBe(1);
    expect(levenshteinSimilarity('amazng', 'amazing')).toBeGreaterThan(0.8);
    expect(levenshteinSimilarity('hwo', 'how')).toBeGreaterThan(0.6);
  });

  test('returns all songs when query is empty (on click / focus)', () => {
    const results = fuzzySearchSongs(mockLibrary, '');
    expect(results.length).toBe(mockLibrary.length);
  });

  test('finds "Amazing Grace" with severe typos ("amazng grce")', () => {
    const results = fuzzySearchSongs(mockLibrary, 'amazng grce');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Amazing Grace');
    expect(results[0]._isCloseMatch).toBe(true);
  });

  test('finds "How Great Thou Art" with typos ("hwo gret")', () => {
    const results = fuzzySearchSongs(mockLibrary, 'hwo gret');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('How Great Thou Art');
  });

  test('finds "Way Maker" with concatenated typo ("waymker")', () => {
    const results = fuzzySearchSongs(mockLibrary, 'waymker');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Way Maker');
  });

  test('finds "10,000 Reasons" without comma and with typo ("10000 resons")', () => {
    const results = fuzzySearchSongs(mockLibrary, '10000 resons');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('10,000 Reasons (Bless The Lord)');
  });

  test('finds "Goodness of God" with typo ("gudness of god")', () => {
    const results = fuzzySearchSongs(mockLibrary, 'gudness of god');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Goodness of God');
  });

  test('matches by acronym ("hgta" -> "How Great Thou Art")', () => {
    const results = fuzzySearchSongs(mockLibrary, 'hgta');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('How Great Thou Art');
  });

  test('matches by artist name ("Matt Redman")', () => {
    const results = fuzzySearchSongs(mockLibrary, 'Matt Redman');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('10,000 Reasons (Bless The Lord)');
  });

  test('excludes completely unrelated search', () => {
    const results = fuzzySearchSongs(mockLibrary, 'xyz random gibberish 987');
    expect(results.length).toBe(0);
  });
});
