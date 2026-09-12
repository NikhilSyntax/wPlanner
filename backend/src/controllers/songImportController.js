const { defaultSongImportService } = require('../services/songImport/SongImportService');

/**
 * Handles searching external providers for songs
 * GET /api/songs/import/search?q=...
 */
exports.searchSongs = async (req, res) => {
  try {
    const query = req.query.q || req.query.query;
    const provider = req.query.provider || 'ultimate_guitar';
    const language = req.query.language;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ message: 'Search query parameter (q) is required.' });
    }

    const churchId = req.user?.churchId;
    const result = await defaultSongImportService.searchSongs({
      query: query.trim(),
      churchId,
      provider,
      language,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Song search error:', err.message);

    const statusCode = err.statusCode || 500;
    const message =
      err.message || 'An error occurred while searching for songs. Please try again later.';

    return res.status(statusCode).json({ message });
  }
};

/**
 * Handles fetching best matching Telugu lyrics from ChristianLyricz
 * GET /api/songs/import/telugu?q=...&artist=...
 */
exports.searchTeluguLyrics = async (req, res) => {
  try {
    const query = req.query.q || req.query.query;
    const artist = req.query.artist || '';

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ message: 'Search query parameter (q) is required.' });
    }

    const match = await defaultSongImportService.autoImportTeluguLyrics(query.trim(), artist.trim());
    if (!match || !match.found) {
      return res.status(404).json({ message: `No Telugu lyrics found for "${query}".` });
    }

    return res.status(200).json(match);
  } catch (err) {
    console.error('Telugu lyrics search error:', err.message);
    return res.status(500).json({ message: 'Failed to search ChristianLyricz for Telugu lyrics.' });
  }
};

/**
 * Handles importing a song from an external URL (e.g. Ultimate Guitar)
 * POST /api/songs/import
 */
exports.importSong = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ message: 'A valid song URL is required.' });
    }

    const churchId = req.user?.churchId;
    const result = await defaultSongImportService.importSong({
      url: url.trim(),
      churchId,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Song import error:', err.message);

    const statusCode = err.statusCode || 500;
    const message =
      err.message || 'An unexpected error occurred while importing the song. Please try again.';

    return res.status(statusCode).json({ message });
  }
};

/**
 * Handles parsing raw pasted chords/lyrics into structured sections (Manual fallback)
 * POST /api/songs/parse-raw
 */
exports.parseRaw = async (req, res) => {
  try {
    const { title, artist, key, chords, sourceUrl } = req.body;

    if (!chords || typeof chords !== 'string' || !chords.trim()) {
      return res.status(400).json({ message: 'Chords or lyrics text is required.' });
    }

    const result = defaultSongImportService.parseRawChords({
      title,
      artist,
      key,
      chords,
      sourceUrl,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('Raw chord parse error:', err.message);
    return res.status(500).json({ message: 'Failed to parse chord text.' });
  }
};
