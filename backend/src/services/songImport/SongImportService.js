const Song = require('../../models/Song');
const { UltimateGuitarProvider } = require('./UltimateGuitarProvider');
const { UltimateGuitarParser } = require('./UltimateGuitarParser');
const { ChristianLyriczProvider } = require('./ChristianLyriczProvider');
const { calculateTypoSimilarity } = require('../../utils/typoSimilarity');

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * SongImportService - Orchestrates external song providers, URL routing,
 * data normalization, and duplicate detection.
 */
class SongImportService {
  constructor() {
    this.ugProvider = new UltimateGuitarProvider();
    this.clProvider = new ChristianLyriczProvider();
    this.providers = [this.ugProvider, this.clProvider];
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
        'Unsupported URL. Supported providers include Ultimate Guitar (https://tabs.ultimate-guitar.com/...) and ChristianLyricz (https://christianlyricz.com/...)'
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
   * @param {string} [params.provider] - 'ultimate_guitar', 'christian_lyricz', or 'all'
   * @param {string} [params.language] - Language filter (e.g. 'telugu')
   * @param {object} [params.options] - Optional mock fetcher / timeouts
   * @returns {Promise<object>} Search results with duplicate flags
   */
  async searchSongs({ query, churchId, provider = 'ultimate_guitar', language, options = {} }) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      const err = new Error('Search query is required.');
      err.statusCode = 400;
      throw err;
    }

    let targetProvider = this.ugProvider;
    if (provider === 'christian_lyricz' || language === 'telugu' || /[\u0C00-\u0C7F]/.test(query)) {
      targetProvider = this.clProvider;
    }

    let rawResults = [];
    if (provider === 'all') {
      const [ugRes, clRes] = await Promise.all([
        this.ugProvider.search(query, options).catch(() => []),
        this.clProvider.search(query, { language, ...options }).catch(() => []),
      ]);
      rawResults = [...ugRes, ...clRes];
    } else if (targetProvider && typeof targetProvider.search === 'function') {
      rawResults = await targetProvider.search(query, { language, ...options });
    } else {
      const err = new Error('No search provider available.');
      err.statusCode = 500;
      throw err;
    }

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

  /**
   * Automatically searches and imports Telugu lyrics from ChristianLyricz.
   *
   * @param {string} songTitle - Song title
   * @param {string} [artist] - Optional artist
   * @param {object} [options]
   * @returns {Promise<object|null>}
   */
  async autoImportTeluguLyrics(songTitle, artist = '', options = {}) {
    if (!this.clProvider) return null;
    return this.clProvider.findBestTeluguMatch(songTitle, artist, options);
  }

  /**
   * Search specifically for Telugu Christian songs on ChristianLyricz.
   *
   * @param {string} query
   * @param {object} [options]
   * @returns {Promise<Array<object>>}
   */
  async searchTeluguSongs(query, options = {}) {
    if (!this.clProvider) return [];
    return this.clProvider.search(query, { language: 'telugu', ...options });
  }

  /**
   * Searches external providers with typo tolerance and ranks candidate tabs to pick the best chord sheet.
   *
   * @param {string} query - The search query with potential typos (e.g. "goddness of god")
   * @param {object} [options]
   * @returns {Promise<object|null>} The best matching tab result or null
   */
  async findBestMatch(query, options = {}) {
    const cleanQ = (query || '').trim();
    if (cleanQ.length < 2) return null;

    let allResults = [];
    try {
      const res = await this.searchSongs({ query: cleanQ, options });
      allResults = res?.results || [];
    } catch (err) {
      // Search may fail if rate limited or network offline
    }

    // If initial search had no results, attempt searching significant words
    if (allResults.length === 0) {
      const words = cleanQ.split(/\s+/).filter((w) => w.length >= 3);
      for (const w of words.slice(0, 2)) {
        try {
          const wordRes = await this.searchSongs({ query: w, options });
          if (wordRes?.results && wordRes.results.length > 0) {
            allResults = allResults.concat(wordRes.results);
          }
        } catch (e) {}
      }
    }

    if (allResults.length === 0) return null;

    // Deduplicate results by URL
    const seenUrls = new Set();
    const deduped = [];
    for (const r of allResults) {
      if (r.url && !seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        deduped.push(r);
      }
    }

    // Rank candidates using typo-tolerant similarity + votes volume + ratings
    const scored = deduped.map((r) => {
      const titleSim = calculateTypoSimilarity(cleanQ, r.title);
      const combinedSim = calculateTypoSimilarity(cleanQ, `${r.title} ${r.artist}`);
      const sim = Math.max(titleSim, combinedSim);
      const votesBonus = Math.min(Math.log10((r.votes || 0) + 1) / 4, 1);
      const ratingBonus = (r.rating || 4.5) / 5;
      const totalScore = sim * 0.55 + votesBonus * 0.3 + ratingBonus * 0.15;
      return { ...r, sim, totalScore };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);
    const top = scored[0];
    if (top && top.sim >= 0.35) {
      return top;
    }
    return null;
  }

  /**
   * Automatically searches and imports the top Ultimate Guitar tab sheet for a song query.
   *
   * @param {object} params
   * @param {string} params.query - Song title or query (with potential typos)
   * @param {string|ObjectId} [params.churchId] - User's churchId
   * @param {string} [params.keyPreference] - Optional user key override
   * @param {object} [params.options]
   * @returns {Promise<object>} Import result containing song data or failure status
   */
  async autoImportBestMatch({ query, churchId, keyPreference, options = {} }) {
    try {
      const searchOptions = {
        ...options,
        fetcher: options.searchFetcher || options.fetcher,
      };
      const tabOptions = {
        ...options,
        fetcher: options.tabFetcher || options.fetcher,
      };

      const bestMatch = await this.findBestMatch(query, searchOptions);
      if (!bestMatch || !bestMatch.url) {
        return { imported: false, reason: 'no_match' };
      }

      const importedRes = await this.importSong({
        url: bestMatch.url,
        churchId,
        options: tabOptions,
      });

      if (!importedRes || !importedRes.song) {
        return { imported: false, reason: 'import_failed' };
      }

      return {
        imported: true,
        match: bestMatch,
        song: importedRes.song,
        isDuplicate: importedRes.isDuplicate,
        existingSong: importedRes.existingSong,
      };
    } catch (err) {
      console.warn('Auto-import best match error:', err.message);
      return { imported: false, reason: 'error', error: err.message };
    }
  }
}

const defaultSongImportService = new SongImportService();

module.exports = {
  SongImportService,
  defaultSongImportService,
  calculateTypoSimilarity,
};


