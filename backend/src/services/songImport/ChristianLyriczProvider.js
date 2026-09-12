const axios = require('axios');
const ExternalSongProvider = require('./ExternalSongProvider');
const { calculateTypoSimilarity } = require('../../utils/typoSimilarity');

const SUPABASE_URL = 'https://zeabwyivgsfexgvsnipf.supabase.co';
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplYWJ3eWl2Z3NmZXhndnNuaXBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MDc2MzMsImV4cCI6MjA4NzQ4MzYzM30.mN7Pd_5fM6mBT7VkOg39vq5FTCWpo6jkaNZZw91GMb0';

/**
 * Normalizes an array of lyric strings or a string into a clean multi-line lyric string.
 */
function normalizeLyricsContent(lyrics) {
  if (!lyrics) return '';
  if (Array.isArray(lyrics)) {
    return lyrics.join('\n').trim();
  }
  return String(lyrics).trim();
}

/**
 * Extracts a song slug from any ChristianLyricz URL or path.
 * e.g.
 * - "https://christianlyricz.com/song/anni-kaalambula/" -> "anni-kaalambula"
 * - "https://christianlyricz.com/2016/01/26/anni-kaalambula/" -> "anni-kaalambula"
 * - "https://christianlyricz.com/anni-kaalambula/" -> "anni-kaalambula"
 */
function extractSlugFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim().replace(/^https?:\/\/(?:www\.)?christianlyricz\.com\/?/i, '');
  const segments = clean.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  // If starts with "song", take next segment
  if (segments[0] === 'song' && segments[1]) {
    return segments[1].toLowerCase();
  }
  // Otherwise the last path segment before query params is the slug
  const last = segments[segments.length - 1].split('?')[0].split('#')[0];
  return last ? last.toLowerCase() : null;
}

/**
 * ChristianLyriczProvider - Fetches and searches Telugu, Hindi, and English Christian worship lyrics
 * from https://christianlyricz.com/ (via high-performance Supabase API with HTML fallback).
 */
class ChristianLyriczProvider extends ExternalSongProvider {
  constructor() {
    super('christian_lyricz');
    this.supabaseUrl = SUPABASE_URL;
    this.anonKey = ANON_KEY;
  }

  /**
   * Checks if this provider can handle the given URL.
   * @param {string} url
   * @returns {boolean}
   */
  canHandle(url) {
    if (!url || typeof url !== 'string') return false;
    return /https?:\/\/(?:www\.)?christianlyricz\.com\//i.test(url);
  }

  /**
   * Search ChristianLyricz for songs matching query, focusing on Telugu songs by default.
   *
   * @param {string} query - Search term (English transliteration or Telugu text)
   * @param {object} [options]
   * @param {string} [options.language='telugu'] - Language filter ('telugu', 'hindi', 'english', or 'all')
   * @param {number} [options.limit=10]
   * @returns {Promise<Array<object>>}
   */
  async search(query, options = {}) {
    const cleanQ = (query || '').trim();
    if (!cleanQ) return [];

    const language = (options.language || 'telugu').toLowerCase();
    const limit = options.limit || 10;
    const fetcher = options.fetcher || axios;

    const headers = {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.anonKey}`,
    };

    try {
      const sanitized = cleanQ.replace(/[,*]/g, ' ').trim();
      const orFilter = `title.ilike.*${sanitized}*,title_transliterated.ilike.*${sanitized}*,slug.ilike.*${sanitized}*,search_blob.ilike.*${sanitized}*`;

      let url = `${this.supabaseUrl}/rest/v1/songs?select=id,title,title_transliterated,author_english,author_telugu,language,slug,lyrics_original,lyrics_transliterated,chords,wp_link&or=(${encodeURIComponent(
        orFilter
      )})&limit=${limit}`;

      if (language !== 'all') {
        url += `&language=eq.${encodeURIComponent(language)}`;
      }

      const res = await fetcher.get(url, { headers, timeout: options.timeout || 8000 });
      const rows = Array.isArray(res.data) ? res.data : [];

      return rows.map((r) => {
        const teluguTitle = r.title || '';
        const translitTitle = r.title_transliterated || '';
        const displayTitle = translitTitle && teluguTitle ? `${teluguTitle} (${translitTitle})` : teluguTitle || translitTitle || r.slug;
        const artist = r.author_english || r.author_telugu || 'Unknown Artist';
        const songUrl = r.wp_link || `https://christianlyricz.com/song/${r.slug}/`;

        return {
          id: r.id || r.slug,
          title: displayTitle,
          rawTitle: teluguTitle,
          transliteratedTitle: translitTitle,
          artist,
          url: songUrl,
          slug: r.slug,
          language: r.language || 'telugu',
          hasLyrics: Boolean(r.lyrics_original || r.lyrics_transliterated),
          hasChords: Boolean(r.chords),
          rating: 5,
          votes: 10,
          provider: 'christian_lyricz',
        };
      });
    } catch (err) {
      console.warn('ChristianLyricz search error:', err.message);
      return [];
    }
  }

  /**
   * Fetch song data from ChristianLyricz by URL or slug.
   *
   * @param {string} url - e.g. "https://christianlyricz.com/song/anni-kaalambula/"
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async fetchSong(url, options = {}) {
    const slug = options.slug || extractSlugFromUrl(url);
    const fetcher = options.fetcher || axios;
    const headers = {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.anonKey}`,
    };

    // 1. Try Supabase REST API first
    if (slug) {
      try {
        const apiUrl = `${this.supabaseUrl}/rest/v1/songs?slug=eq.${encodeURIComponent(slug)}&limit=1`;
        const res = await fetcher.get(apiUrl, { headers, timeout: options.timeout || 8000 });
        if (Array.isArray(res.data) && res.data.length > 0) {
          return res.data[0];
        }
      } catch (apiErr) {
        console.warn('ChristianLyricz API fetch failed, trying HTML fallback:', apiErr.message);
      }
    }

    // 2. HTML Scraping Fallback via JSON-LD in <head>
    try {
      const htmlRes = await fetcher.get(url, { timeout: options.timeout || 8000 });
      const html = htmlRes.data || '';

      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const parsedLd = JSON.parse(jsonLdMatch[1]);
          const graph = Array.isArray(parsedLd['@graph']) ? parsedLd['@graph'] : [parsedLd];
          const musicComp = graph.find((item) => item['@type'] === 'MusicComposition') || graph[0];

          if (musicComp) {
            return {
              title: musicComp.name,
              title_transliterated: musicComp.alternateName,
              lyrics_original: musicComp.lyrics?.text || '',
              author_english: musicComp.composer?.name || 'Unknown',
              slug: slug || 'song',
              language: musicComp.inLanguage === 'te' ? 'telugu' : musicComp.inLanguage || 'telugu',
              wp_link: url,
            };
          }
        } catch (e) {}
      }
    } catch (scrapeErr) {
      console.error('ChristianLyricz HTML scrape fallback failed:', scrapeErr.message);
    }

    const notFoundErr = new Error(`Could not find song on ChristianLyricz at ${url}`);
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  /**
   * Parses raw ChristianLyricz payload into wPlanner's normalised song model.
   *
   * @param {object} raw
   * @param {string} sourceUrl
   * @returns {object} Normalised song
   */
  parseSong(raw, sourceUrl) {
    const teluguLyrics = normalizeLyricsContent(raw.lyrics_original);
    const translitLyrics = normalizeLyricsContent(raw.lyrics_transliterated);
    const chords = normalizeLyricsContent(raw.chords);

    const primaryLyrics = teluguLyrics || translitLyrics || '';
    const primaryChords = chords || primaryLyrics;

    const title = raw.title || raw.title_transliterated || 'Christian Song';
    const artist = raw.author_english || raw.author_telugu || 'Unknown Artist';

    const regionalLyrics = [];
    if (teluguLyrics) {
      regionalLyrics.push({
        language: 'Telugu',
        name: raw.title || 'Telugu',
        content: {
          lyrics: teluguLyrics,
          chords: chords || teluguLyrics,
        },
      });
    }

    return {
      title,
      artist,
      key: 'C',
      bpm: undefined,
      timeSignature: '4/4',
      capo: 0,
      tuning: 'Standard',
      source: {
        type: 'external',
        provider: 'christian_lyricz',
        url: sourceUrl || raw.wp_link || (raw.slug ? `https://christianlyricz.com/song/${raw.slug}/` : null),
        importedAt: new Date(),
      },
      content: {
        chords: primaryChords,
        lyrics: primaryLyrics,
        tabs: '',
      },
      regionalLyrics,
      metadata: {
        titleTelugu: raw.title,
        titleTransliterated: raw.title_transliterated,
        lyricsTelugu: teluguLyrics,
        lyricsTransliterated: translitLyrics,
        language: raw.language || 'telugu',
      },
    };
  }

  /**
   * Searches ChristianLyricz and finds the best matching Telugu lyrics for a given song title.
   * Uses typo-tolerant fuzzy matching across native script, transliterated title, and artist.
   *
   * @param {string} query - Song title (e.g. "Anni Kaalambula", "Nee Krupa", "Hosanna")
   * @param {string} [artist] - Optional artist name
   * @param {object} [options]
   * @returns {Promise<object|null>} Matched Telugu lyrics or null
   */
  async findBestTeluguMatch(query, artist = '', options = {}) {
    const cleanQ = (query || '').trim();
    if (cleanQ.length < 2) return null;

    let results = await this.search(cleanQ, { language: 'telugu', limit: 10, ...options });

    // Fallback: If no results, try individual words
    if (results.length === 0) {
      const words = cleanQ.split(/\s+/).filter((w) => w.length >= 3);
      for (const w of words.slice(0, 2)) {
        const sub = await this.search(w, { language: 'telugu', limit: 5, ...options });
        if (sub.length > 0) {
          results = results.concat(sub);
        }
      }
    }

    if (results.length === 0) return null;

    // Deduplicate results by slug/url
    const seen = new Set();
    const deduped = [];
    for (const r of results) {
      const key = r.slug || r.url;
      if (key && !seen.has(key)) {
        seen.add(key);
        deduped.push(r);
      }
    }

    // Rank candidates using typo-tolerant similarity
    const scored = deduped.map((r) => {
      const teluguSim = calculateTypoSimilarity(cleanQ, r.rawTitle || '');
      const translitSim = calculateTypoSimilarity(cleanQ, r.transliteratedTitle || '');
      const slugSim = calculateTypoSimilarity(cleanQ, (r.slug || '').replace(/-/g, ' '));
      const combinedSim = calculateTypoSimilarity(
        `${cleanQ} ${artist || ''}`.trim(),
        `${r.transliteratedTitle || r.rawTitle || ''} ${r.artist || ''}`.trim()
      );

      const bestSim = Math.max(teluguSim, translitSim, slugSim, combinedSim);
      return {
        ...r,
        similarity: bestSim,
      };
    });

    scored.sort((a, b) => b.similarity - a.similarity);
    const top = scored[0];

    if (top && top.similarity >= 0.35) {
      try {
        const fullDoc = await this.fetchSong(top.url, { slug: top.slug, ...options });
        const parsed = this.parseSong(fullDoc, top.url);
        return {
          found: true,
          similarity: top.similarity,
          language: 'Telugu',
          teluguTitle: fullDoc.title || top.rawTitle,
          transliteratedTitle: fullDoc.title_transliterated || top.transliteratedTitle,
          lyrics: parsed.content.lyrics,
          chords: parsed.content.chords,
          transliteratedLyrics: parsed.metadata?.lyricsTransliterated || '',
          url: top.url,
          author: parsed.artist,
        };
      } catch (fetchErr) {
        console.warn('Failed to fetch full lyrics for top match:', fetchErr.message);
      }
    }

    return null;
  }
}

module.exports = {
  ChristianLyriczProvider,
  normalizeLyricsContent,
  extractSlugFromUrl,
};
