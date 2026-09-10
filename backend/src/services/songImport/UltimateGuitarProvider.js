const dns = require('dns').promises;
const net = require('net');
const ExternalSongProvider = require('./ExternalSongProvider');
const { UltimateGuitarParser } = require('./UltimateGuitarParser');

const ALLOWED_HOSTS = new Set([
  'tabs.ultimate-guitar.com',
  'www.ultimate-guitar.com',
  'ultimate-guitar.com',
]);

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB limit

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 127) return true; // Loopback
    if (parts[0] === 10) return true;  // Private
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // Private
    if (parts[0] === 192 && parts[1] === 168) return true; // Private
    if (parts[0] === 169 && parts[1] === 254) return true; // Link-local / Cloud metadata
    if (parts[0] === 0) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe80')) return true;
    return false;
  }
  return true;
}

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function extractUgStoreData(html) {
  if (!html || typeof html !== 'string') return null;

  // Pattern 1: <div class="js-store" data-content="...">
  const divMatch =
    html.match(/class=["'](?:[^"']*\s)?js-store(?:\s[^"']*)?["'][^>]*data-content=["']([\s\S]*?)["']/i) ||
    html.match(/data-content=["']([\s\S]*?)["'][^>]*class=["'](?:[^"']*\s)?js-store(?:\s[^"']*)?["']/i);

  if (divMatch && divMatch[1]) {
    try {
      const decoded = decodeHtmlEntities(divMatch[1]);
      const json = JSON.parse(decoded);
      return json?.store?.page?.data || json?.page?.data || json?.data || json;
    } catch {
      // Try next method
    }
  }

  // Pattern 2: window.UGAPP.store.page = ...
  const scriptMatch =
    html.match(/window\.UGAPP\s*=\s*window\.UGAPP\s*\|\|\s*\{\};\s*window\.UGAPP\.store\s*=\s*window\.UGAPP\.store\s*\|\|\s*\{\};\s*window\.UGAPP\.store\.page\s*=\s*(\{[\s\S]*?\});/i) ||
    html.match(/"store":\s*\{\s*"page":\s*\{\s*"data":\s*(\{[\s\S]*?\})\s*\}\s*\}/i);

  if (scriptMatch && scriptMatch[1]) {
    try {
      const json = JSON.parse(scriptMatch[1]);
      return json?.data || json;
    } catch {
      // Failed
    }
  }

  return null;
}

/**
 * UltimateGuitarProvider - Implements ExternalSongProvider for Ultimate Guitar.
 */
class UltimateGuitarProvider extends ExternalSongProvider {
  constructor() {
    super('ultimate_guitar');
  }

  /**
   * Determine if the URL belongs to Ultimate Guitar tab pages
   */
  canHandle(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url.trim());
      const host = parsed.hostname.toLowerCase();
      return (
        (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
        ALLOWED_HOSTS.has(host) &&
        parsed.pathname.includes('/tab/')
      );
    } catch {
      return false;
    }
  }

  /**
   * Validates URL and guards against SSRF, loopback, and private network requests.
   */
  async validateUrl(urlString) {
    if (!urlString || typeof urlString !== 'string' || !urlString.trim()) {
      const err = new Error('URL is required.');
      err.statusCode = 400;
      throw err;
    }

    let parsed;
    try {
      parsed = new URL(urlString.trim());
    } catch {
      const err = new Error('Invalid URL format.');
      err.statusCode = 400;
      throw err;
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      const err = new Error('Only HTTP and HTTPS URLs are supported.');
      err.statusCode = 400;
      throw err;
    }

    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(host)) {
      const err = new Error(
        'Unsupported URL. Only legitimate Ultimate Guitar chord/tab URLs (e.g., https://tabs.ultimate-guitar.com/tab/...) are supported.'
      );
      err.statusCode = 400;
      throw err;
    }

    if (!parsed.pathname.includes('/tab/')) {
      const err = new Error(
        'URL does not point to an Ultimate Guitar tab or chord page (must include "/tab/").'
      );
      err.statusCode = 400;
      throw err;
    }

    // SSRF DNS check
    try {
      const addresses = await dns.lookup(host, { all: true });
      if (!addresses || addresses.length === 0) {
        const err = new Error('Could not resolve Ultimate Guitar hostname.');
        err.statusCode = 400;
        throw err;
      }
      for (const addr of addresses) {
        if (isPrivateIp(addr.address)) {
          const err = new Error('Access to private or local network addresses is forbidden.');
          err.statusCode = 400;
          throw err;
        }
      }
    } catch (err) {
      if (err.statusCode) throw err;
      const wrapErr = new Error('Unable to resolve domain for Ultimate Guitar.');
      wrapErr.statusCode = 400;
      throw wrapErr;
    }

    return parsed.toString();
  }

  /**
   * Fetch song page from Ultimate Guitar with safety bounds.
   */
  async fetchSong(url, options = {}) {
    const validatedUrl = await this.validateUrl(url);

    // Allow mock fetcher in test options
    const fetcher = options.fetcher || globalThis.fetch;

    let response;
    try {
      response = await fetcher(validatedUrl, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(options.timeoutMs || 10000),
        redirect: 'follow',
      });
    } catch (netErr) {
      if (netErr.name === 'TimeoutError' || netErr.name === 'AbortError') {
        const err = new Error('Request to Ultimate Guitar timed out. Please try again or paste chords manually.');
        err.statusCode = 504;
        throw err;
      }
      const err = new Error('External source unavailable. Could not connect to Ultimate Guitar.');
      err.statusCode = 502;
      throw err;
    }

    if (response.status === 404) {
      const err = new Error('The requested Ultimate Guitar song or chord page was not found.');
      err.statusCode = 404;
      throw err;
    }

    if (response.status === 403) {
      const err = new Error(
        'Ultimate Guitar could not be imported automatically due to site verification. You can paste the chord/lyric content into the editor instead.'
      );
      err.statusCode = 502;
      throw err;
    }

    if (response.status === 429) {
      const err = new Error('Ultimate Guitar rate limit reached. Please wait a moment or paste chords directly.');
      err.statusCode = 429;
      throw err;
    }

    if (response.status >= 500) {
      const err = new Error('Ultimate Guitar server error. Please try again later or paste chords directly.');
      err.statusCode = 502;
      throw err;
    }

    if (!response.ok) {
      const err = new Error(`Failed to load song from Ultimate Guitar (HTTP ${response.status}).`);
      err.statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
      throw err;
    }

    // Enforce maximum response size
    const htmlText = await response.text();
    if (htmlText.length > MAX_RESPONSE_BYTES) {
      const err = new Error('Response from Ultimate Guitar exceeded maximum allowed size (2MB).');
      err.statusCode = 422;
      throw err;
    }

    return htmlText;
  }

  /**
   * Parse fetched raw HTML or JSON payload into normalised Song
   */
  parseSong(rawPayload, sourceUrl = '') {
    if (!rawPayload) {
      const err = new Error('No content received to parse.');
      err.statusCode = 422;
      throw err;
    }

    let ugData = null;

    // Case 1: Payload is already parsed JSON object
    if (typeof rawPayload === 'object') {
      ugData = rawPayload?.store?.page?.data || rawPayload?.data || rawPayload;
    } else if (typeof rawPayload === 'string') {
      // Case 2: String payload is direct JSON
      if (rawPayload.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(rawPayload);
          ugData = parsed?.store?.page?.data || parsed?.data || parsed;
        } catch {
          ugData = null;
        }
      }

      // Case 3: String payload is HTML document
      if (!ugData) {
        ugData = extractUgStoreData(rawPayload);
      }
    }

    if (!ugData || (!ugData.tab && !ugData.tab_view && !ugData.content && !ugData.rawContent)) {
      const err = new Error(
        'Imported content could not be parsed. The page structure may have changed or the tab is unavailable.'
      );
      err.statusCode = 422;
      throw err;
    }

    return UltimateGuitarParser.parse(ugData, sourceUrl);
  }

  /**
   * Searches Ultimate Guitar for chord charts matching a query
   * @param {string} query - Song title, artist, or combined query
   * @param {object} options - Optional fetcher / timeout overrides
   * @returns {Promise<Array<object>>} Normalized search results
   */
  async search(query, options = {}) {
    if (!query || typeof query !== 'string' || !query.trim()) {
      const err = new Error('Search query is required.');
      err.statusCode = 400;
      throw err;
    }

    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      const err = new Error('Search query must be at least 2 characters long.');
      err.statusCode = 400;
      throw err;
    }

    if (cleanQuery.length > 100) {
      const err = new Error('Search query cannot exceed 100 characters.');
      err.statusCode = 400;
      throw err;
    }

    // SSRF validation for www.ultimate-guitar.com
    const searchHost = 'www.ultimate-guitar.com';
    const fetcher = options.fetcher || globalThis.fetch;
    const timeoutMs = options.timeoutMs || 10000;

    if (!options.fetcher) {
      try {
        const addresses = await dns.lookup(searchHost, { all: true });
        for (const addr of addresses) {
          if (isPrivateIp(addr.address)) {
            const err = new Error('Search host resolved to private/restricted IP.');
            err.statusCode = 403;
            throw err;
          }
        }
      } catch (dnsErr) {
        if (dnsErr.statusCode) throw dnsErr;
        const err = new Error('Could not resolve Ultimate Guitar server.');
        err.statusCode = 502;
        throw err;
      }
    }

    const searchUrl = `https://${searchHost}/search.php?search_type=title&value=${encodeURIComponent(cleanQuery)}`;

    let response;
    try {
      response = await fetcher(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (fetchErr) {
      if (fetchErr.name === 'TimeoutError' || fetchErr.message?.includes('timeout') || fetchErr.name === 'AbortError') {
        const err = new Error('Search request timed out. Please try again.');
        err.statusCode = 504;
        throw err;
      }
      const err = new Error('Network error searching Ultimate Guitar.');
      err.statusCode = 502;
      throw err;
    }

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      if (response.status === 429) {
        const err = new Error('Search rate limit reached. Please wait a moment and try again.');
        err.statusCode = 429;
        throw err;
      }
      if (response.status === 403) {
        const err = new Error('Ultimate Guitar search is temporarily unavailable. Please try again later.');
        err.statusCode = 403;
        throw err;
      }
      const err = new Error(`Ultimate Guitar search returned HTTP ${response.status}.`);
      err.statusCode = response.status >= 500 ? 502 : response.status;
      throw err;
    }

    const htmlText = await response.text();
    if (htmlText.length > MAX_RESPONSE_BYTES) {
      const err = new Error('Search response exceeded size limit.');
      err.statusCode = 422;
      throw err;
    }

    // Extract store data
    const ugData = extractUgStoreData(htmlText);
    const rawResults = ugData?.results || [];

    // Filter strictly for Chords tabs
    const chordResults = rawResults.filter((item) => {
      const type = String(item.type || item.type_name || '').toLowerCase();
      return type === 'chords' || item.type === 300;
    });

    return chordResults.map((item) => {
      const rawRating = parseFloat(item.rating);
      return {
        id: String(item.id || item.tab_id || ''),
        provider: 'ultimate_guitar',
        title: item.song_name || item.localized_song_name || cleanQuery,
        artist: item.artist_name || item.localized_artist_name || 'Unknown Artist',
        type: 'Chords',
        url: item.tab_url || '',
        rating: !isNaN(rawRating) && rawRating > 0 ? Math.round(rawRating * 10) / 10 : null,
        votes: typeof item.votes === 'number' ? item.votes : 0,
        version: item.version || 1,
        tonality: item.tonality_name || null,
        capo: typeof item.capo === 'number' ? item.capo : (item.recording?.capo || 0),
        versionDescription: item.version_description
          ? decodeHtmlEntities(item.version_description).trim()
          : null,
      };
    });
  }
}

module.exports = {
  UltimateGuitarProvider,
  isPrivateIp,
  extractUgStoreData,
  decodeHtmlEntities,
};
