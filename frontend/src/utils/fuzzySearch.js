/**
 * Netflix-style intelligent typo-tolerant fuzzy search for songs.
 * Supports:
 * - Levenshtein / Damerau edit distance
 * - Character N-gram (Bigram / Trigram) Dice similarity
 * - Acronym / Initialism matching (e.g. "hgta" -> "How Great Thou Art")
 * - Token-level unordered multi-word matching
 * - Substring / prefix boosts
 * - Punctuation & number normalization ("10,000" == "10000")
 */

/**
 * Normalizes text: lowercase, replaces punctuation with spaces, collapses whitespace.
 */
export function normalizeSearchString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[,'.’"“”\-–—]/g, '') // strip punctuation within numbers/words (e.g. "10,000" -> "10000", "don't" -> "dont")
    .replace(/[^a-z0-9\s]/g, ' ') // replace other special symbols with spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates Damerau-Levenshtein distance (supports transpositions)
 */
export function damerauLevenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const d = [];
  const aLen = a.length;
  const bLen = b.length;

  for (let i = 0; i <= aLen; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= bLen; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost); // transposition
      }
    }
  }

  return d[aLen][bLen];
}

/**
 * Levenshtein similarity score between 0.0 and 1.0
 */
export function levenshteinSimilarity(s1, s2) {
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1;
  const dist = damerauLevenshteinDistance(s1, s2);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Generates character n-grams
 */
function getNGrams(str, n = 2) {
  const ngrams = new Set();
  const clean = str.replace(/\s+/g, '');
  if (clean.length < n) {
    if (clean.length > 0) ngrams.add(clean);
    return ngrams;
  }
  for (let i = 0; i <= clean.length - n; i++) {
    ngrams.add(clean.substring(i, i + n));
  }
  return ngrams;
}

/**
 * N-gram Dice coefficient similarity (0.0 to 1.0)
 */
export function ngramSimilarity(s1, s2, n = 2) {
  if (!s1 && !s2) return 1;
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const ngrams1 = getNGrams(s1, n);
  const ngrams2 = getNGrams(s2, n);
  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;

  let intersection = 0;
  for (const gram of ngrams1) {
    if (ngrams2.has(gram)) {
      intersection++;
    }
  }

  return (2.0 * intersection) / (ngrams1.size + ngrams2.size);
}

/**
 * Generates acronym from string (e.g. "How Great Thou Art" -> "hgta")
 */
function getAcronym(str) {
  return str
    .split(/\s+/)
    .map((word) => word[0] || '')
    .join('');
}

/**
 * Scores how closely a query string matches a song title and artist
 * Returns score between 0.0 and 1.0
 */
export function calculateSongMatchScore(query, song) {
  if (!query || !query.trim()) return 1.0;
  if (!song) return 0.0;

  const rawTitle = song.title || '';
  const rawArtist = song.artist || '';

  const qClean = normalizeSearchString(query);
  const tClean = normalizeSearchString(rawTitle);
  const aClean = normalizeSearchString(rawArtist);

  if (!qClean) return 1.0;
  if (!tClean && !aClean) return 0.0;

  // 1. Exact matches
  if (tClean === qClean) return 1.0;
  if (tClean.replace(/\s+/g, '') === qClean.replace(/\s+/g, '')) return 0.98;

  // 2. Exact prefix / substring matches
  if (tClean.startsWith(qClean)) return 0.95;
  if (tClean.includes(qClean)) return 0.88;

  // Compact substring match (ignoring spaces e.g. "waymaker" matches "way maker")
  const compactTitle = tClean.replace(/\s+/g, '');
  const compactQuery = qClean.replace(/\s+/g, '');
  if (compactTitle.includes(compactQuery)) return 0.90;

  // 3. Acronym match (e.g. "hgta" for "How Great Thou Art", "ag" for "Amazing Grace")
  const acronym = getAcronym(tClean);
  if (acronym && compactQuery.length >= 2 && acronym.startsWith(compactQuery)) {
    return 0.85;
  }

  // 4. Token-level fuzzy matching
  const qTokens = qClean.split(' ').filter(Boolean);
  const tTokens = tClean.split(' ').filter(Boolean);

  let tokenMatchSum = 0;
  for (const qTok of qTokens) {
    let bestTokenScore = 0;
    for (const tTok of tTokens) {
      if (tTok === qTok) {
        bestTokenScore = Math.max(bestTokenScore, 1.0);
      } else if (tTok.startsWith(qTok)) {
        bestTokenScore = Math.max(bestTokenScore, 0.85);
      } else {
        const lev = levenshteinSimilarity(qTok, tTok);
        const dice = ngramSimilarity(qTok, tTok, 2);
        const combined = lev * 0.6 + dice * 0.4;
        bestTokenScore = Math.max(bestTokenScore, combined);
      }
    }
    // Also check token against the full title
    if (tClean.includes(qTok)) {
      bestTokenScore = Math.max(bestTokenScore, 0.8);
    }
    tokenMatchSum += bestTokenScore;
  }

  const tokenScore = qTokens.length > 0 ? tokenMatchSum / qTokens.length : 0;

  // 5. Full string fuzzy distances
  const fullLev = levenshteinSimilarity(qClean, tClean);
  const fullDice = ngramSimilarity(qClean, tClean, 2);
  const fullFuzzy = fullLev * 0.5 + fullDice * 0.5;

  // 6. Compact fuzzy distance (handles concatenated words like "waymker")
  const compactLev = levenshteinSimilarity(compactQuery, compactTitle);
  const compactDice = ngramSimilarity(compactQuery, compactTitle, 2);
  const compactFuzzy = compactLev * 0.5 + compactDice * 0.5;

  // 7. Check artist similarity if query matches artist
  let artistBonus = 0;
  if (aClean) {
    if (aClean.includes(qClean)) artistBonus = 0.75;
    else {
      const aLev = levenshteinSimilarity(qClean, aClean);
      if (aLev > 0.6) artistBonus = aLev * 0.7;
    }
  }

  const maxTitleScore = Math.max(tokenScore, fullFuzzy, compactFuzzy);
  const finalScore = Math.max(maxTitleScore, artistBonus);

  return finalScore;
}

/**
 * Filters and sorts songs using intelligent fuzzy matching
 * @param {Array} songs List of song objects
 * @param {string} query Search input from user
 * @param {number} threshold Minimum match score (0.0 to 1.0)
 * @returns {Array} Matched songs sorted by relevance score
 */
export function fuzzySearchSongs(songs = [], query = '', threshold = 0.4) {
  if (!Array.isArray(songs) || songs.length === 0) return [];
  const q = (query || '').trim();

  // If no query, return all songs in alphabetical order
  if (!q) {
    return [...songs].sort((a, b) =>
      String(a.title || '').localeCompare(String(b.title || ''))
    );
  }

  const scored = songs
    .map((song) => {
      const score = calculateSongMatchScore(q, song);
      return {
        song,
        score,
        isExact: score >= 0.95,
        isClose: score >= 0.65,
      };
    })
    .filter((item) => item.score >= threshold)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.song.title || '').localeCompare(
        String(b.song.title || '')
      );
    });

  return scored.map((item) => ({
    ...item.song,
    _matchScore: item.score,
    _isExactMatch: item.isExact,
    _isCloseMatch: item.isClose,
  }));
}
