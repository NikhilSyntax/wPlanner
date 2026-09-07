const Song = require('../../models/Song');
const { UltimateGuitarProvider } = require('./UltimateGuitarProvider');
const { UltimateGuitarParser } = require('./UltimateGuitarParser');

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * SongImportService - Orchestrates external song providers, URL routing,
 * data normalization, and duplicate detection.
 */
class SongImportService {
  constructor() {
    this.providers = [new UltimateGuitarProvider()];
  }

  /**
   * Register a new external song provider (e.g. ChordPro, CCLI)
   * @param {ExternalSongProvider} provider
   */
  registerProvider(provider) {
    this.providers.push(provider);
  }

  /**
   * Finds a provider that can handle the URL
   * @param {string} url
   * @returns {ExternalSongProvider|null}
   */
  getProviderForUrl(url) {
    return this.providers.find((p) => p.canHandle(url)) || null;
  }

  /**
   * Import a song from a given URL
   *
   * @param {object} params
   * @param {string} params.url - External song URL
   * @param {string|ObjectId} params.churchId - Current user's churchId for duplicate checking
   * @param {object} [params.options] - Optional mock fetcher / timeouts for testing
   * @returns {Promise<object>} Normalised song with duplicate detection status
   */
  async importSong({ url, churchId, options = {} }) {
    if (!url || typeof url !== 'string' || !url.trim()) {
      const err = new Error('URL is required.');
      err.statusCode = 400;
      throw err;
    }

    const trimmedUrl = url.trim();
    const provider = this.getProviderForUrl(trimmedUrl);

    if (!provider) {
      const err = new Error(
        'Unsupported URL. Only Ultimate Guitar tab/chord URLs (https://tabs.ultimate-guitar.com/tab/...) are currently supported.'
      );
      err.statusCode = 400;
      throw err;
    }

    // 1. Fetch raw song payload
    const rawPayload = await provider.fetchSong(trimmedUrl, options);

    // 2. Parse into normalised wPlanner song representation
    const normalisedSong = provider.parseSong(rawPayload, trimmedUrl);

    // 3. Duplicate Detection within the user's church library
    let isDuplicate = false;
    let existingSong = null;

    if (churchId && Song) {
      try {
        const queryConditions = [];
        if (trimmedUrl) {
          queryConditions.push({ 'source.url': trimmedUrl });
        }
        if (normalisedSong.title && normalisedSong.artist) {
          queryConditions.push({
            title: { $regex: new RegExp(`^${escapeRegex(normalisedSong.title)}$`, 'i') },
            artist: { $regex: new RegExp(`^${escapeRegex(normalisedSong.artist)}$`, 'i') },
          });
        }

        if (queryConditions.length > 0) {
          const match = await Song.findOne({
            churchId,
            $or: queryConditions,
          }).lean();

          if (match) {
            isDuplicate = true;
            existingSong = {
              _id: match._id,
              title: match.title,
              artist: match.artist,
              key: match.key,
            };
          }
        }
      } catch (dbErr) {
        console.warn('Duplicate detection check warning:', dbErr.message);
      }
    }

    return {
      success: true,
      song: normalisedSong,
      isDuplicate,
      existingSong,
    };
  }

  /**
   * Parses raw pasted chord/lyric text into structured sections and lines
   * Used as the manual fallback when external fetch is restricted or offline.
   */
  parseRawChords({ title, artist, key, chords, sourceUrl = '' }) {
    const rawContent = chords || '';
    const { sections, chordsContent, lyricsContent } = UltimateGuitarParser.parseContent(rawContent);

    return {
      success: true,
      song: {
        title: (title || 'Pasted Song').trim(),
        artist: (artist || 'Unknown Artist').trim(),
        key: key || 'C',
        bpm: undefined,
        timeSignature: '4/4',
        capo: 0,
        tuning: 'Standard',
        source: {
          type: 'manual',
          provider: 'manual_paste',
          url: sourceUrl || null,
          importedAt: new Date(),
        },
        content: {
          chords: chordsContent,
          lyrics: lyricsContent,
          tabs: '',
        },
        sections,
      },
      isDuplicate: false,
      existingSong: null,
    };
  }

  /**
   * Search external providers for songs and annotate with church library duplicate flags.
   *
   * @param {object} params
   * @param {string} params.query - Search query (title / artist)
   * @param {string|ObjectId} [params.churchId] - Church ID for duplicate checks
   * @param {object} [params.options] - Optional mock fetcher / timeouts
   * @returns {Promise<object>} Search results with duplicate flags
   */
  async searchSongs({ query, churchId, options = {} }) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      const err = new Error('Search query is required.');
      err.statusCode = 400;
      throw err;
    }

    const provider = this.providers[0];
    if (!provider || typeof provider.search !== 'function') {
      const err = new Error('No search provider available.');
      err.statusCode = 500;
      throw err;
    }

    const rawResults = await provider.search(query, options);

    // Cross-reference with church song library for duplicate matching
    let librarySongs = [];
    if (churchId && Song) {
      try {
        librarySongs = await Song.find(
          { churchId },
          { _id: 1, title: 1, artist: 1, key: 1, 'source.url': 1 }
        ).lean();
      } catch (dbErr) {
        console.warn('Could not query library songs for duplicate check:', dbErr.message);
      }
    }

    const results = rawResults.map((item) => {
      let matchedSong = null;

      if (librarySongs.length > 0) {
        // Match by source URL
        if (item.url) {
          matchedSong = librarySongs.find(
            (s) => s.source?.url && s.source.url.toLowerCase() === item.url.toLowerCase()
          );
        }

        // Match by title and artist
        if (!matchedSong && item.title) {
          const itemTitle = item.title.trim().toLowerCase();
          const itemArtist = (item.artist || '').trim().toLowerCase();

          matchedSong = librarySongs.find((s) => {
            const sTitle = (s.title || '').trim().toLowerCase();
            const sArtist = (s.artist || '').trim().toLowerCase();
            if (sTitle === itemTitle) {
              if (!itemArtist || itemArtist === 'various artists' || itemArtist === 'unknown artist' || !sArtist) {
                return true;
              }
              return sArtist.includes(itemArtist) || itemArtist.includes(sArtist);
            }
            return false;
          });
        }
      }

      return {
        ...item,
        inLibrary: Boolean(matchedSong),
        existingSongId: matchedSong ? matchedSong._id : null,
        existingSongTitle: matchedSong ? matchedSong.title : null,
      };
    });

    return {
      success: true,
      query: query.trim(),
      count: results.length,
      results,
    };
  }
}

const defaultSongImportService = new SongImportService();

module.exports = {
  SongImportService,
  defaultSongImportService,
};
