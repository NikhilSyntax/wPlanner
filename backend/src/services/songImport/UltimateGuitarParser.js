const { snapToGraphemeCluster } = require('../../utils/songParser');

const VALID_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CHORD_REGEX_STR =
  '([A-G][#b]?(?:m|min|maj|dim|aug|sus[24]?|add[29]?|[2-9]|11|13|maj7|m7|7|6|9|dim7)?(?:\\/[A-G][#b]?)?)';
const CHORD_TOKEN_REGEX = new RegExp(`^${CHORD_REGEX_STR}$`);

const SECTION_HEADER_REGEX =
  /^\s*(\[|\()?(Intro|Verse(?:\s*\d+)?|Chorus(?:\s*\d+)?|Pre-Chorus(?:\s*\d+)?|Bridge(?:\s*\d+)?|Outro|Ending|Tag|Interlude|Hook|Solo|Instrumental|Prelude|Postlude|Pallavi(?:\s*\d+)?|Anupallavi(?:\s*\d+)?|Charanam(?:\s*\d+)?|Refrain|Stanza(?:\s*\d+)?|Coro|Estrofa(?:\s*\d+)?|Puente)(\]|\)|\:)?\s*$/i;

/**
 * Checks if a trimmed line is a section heading
 */
function isSectionHeading(line) {
  const trimmed = (line || '').replace(/\[\/?tab\]/gi, '').trim();
  if (!trimmed) return false;
  if (SECTION_HEADER_REGEX.test(trimmed)) return true;

  // Generalized bracket matching: e.g. [Prelude], [Pallavi], [Special Section]
  const bracketMatch = trimmed.match(/^\[([^\]]+)\]$/);
  if (bracketMatch) {
    const inner = bracketMatch[1].trim();
    if (/^(tab|\/tab|ch|\/ch)$/i.test(inner)) return false;
    if (CHORD_TOKEN_REGEX.test(inner)) return false; // [G] is an inline chord, not a section
    return true;
  }
  return false;
}

/**
 * Maps arbitrary key strings to valid wPlanner musical key enums
 */
function normalizeKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return 'C';
  const clean = rawKey.trim();
  if (VALID_KEYS.includes(clean)) return clean;

  const flatsToSharps = {
    Db: 'C#',
    Eb: 'D#',
    Gb: 'F#',
    Ab: 'G#',
    Bb: 'A#',
  };
  if (flatsToSharps[clean]) return flatsToSharps[clean];

  const match = clean.match(/^([A-G])([#b]?)/);
  if (match) {
    const note = match[1] + (match[2] || '');
    if (VALID_KEYS.includes(note)) return note;
    if (flatsToSharps[note]) return flatsToSharps[note];
  }
  return 'C';
}

/**
 * Classifies section type from header title
 */
function classifySection(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('verse') || lower.includes('charanam') || lower.includes('stanza') || lower.includes('estrofa')) return 'verse';
  if (lower.includes('chorus') || lower.includes('pallavi') || lower.includes('refrain') || lower.includes('coro') || lower.includes('hook')) return 'chorus';
  if (lower.includes('bridge') || lower.includes('puente')) return 'bridge';
  if (lower.includes('intro') || lower.includes('prelude')) return 'intro';
  if (lower.includes('outro') || lower.includes('ending') || lower.includes('postlude')) return 'outro';
  if (lower.includes('pre-chorus') || lower.includes('prechorus') || lower.includes('anupallavi')) return 'pre-chorus';
  if (lower.includes('interlude') || lower.includes('instrumental') || lower.includes('solo')) return 'instrumental';
  if (lower.includes('tag')) return 'tag';
  return 'other';
}

/**
 * Check if a plain line is primarily chord tokens
 */
function isPlainChordLine(line) {
  const cleanLine = (line || '').replace(/\[\/?tab\]/gi, '');
  const trimmed = cleanLine.trim();
  if (!trimmed) return false;
  if (isSectionHeading(trimmed)) return false;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  for (const token of tokens) {
    if (CHORD_TOKEN_REGEX.test(token)) {
      chordCount++;
    }
  }
  return chordCount / tokens.length >= 0.5;
}

/**
 * Parses a chord line (either containing [ch]...[/ch] tags or plain whitespace-separated chords)
 * into a clean monospace representation and structured chord anchors with character column positions.
 * Automatically removes any [tab] or [/tab] tags so they never leak into the chord sheet.
 */
function parseChordLine(rawLine, targetLyric = '') {
  // Strip [tab] and [/tab] before parsing chords
  const cleanSource = (rawLine || '').replace(/\[\/?tab\]/gi, '');

  // Case A: Ultimate Guitar [ch]...[/ch] tags
  if (/\[ch\]/i.test(cleanSource)) {
    let cleanLine = '';
    const chords = [];
    let lastIdx = 0;
    const regex = /\[ch\](.*?)\[\/ch\]/gi;
    let match;

    while ((match = regex.exec(cleanSource)) !== null) {
      const textBefore = cleanSource.substring(lastIdx, match.index);
      cleanLine += textBefore;
      const rawPos = cleanLine.length;
      const chordText = match[1].trim();
      const pos = targetLyric ? snapToGraphemeCluster(rawPos, targetLyric) : rawPos;

      chords.push({
        chord: chordText,
        position: pos,
      });

      cleanLine += chordText;
      lastIdx = match.index + match[0].length;
    }
    cleanLine += cleanSource.substring(lastIdx);
    return { cleanLine, chords };
  }

  // Case B: Plain whitespace-separated chord line
  const chords = [];
  const tokenRegex = /\S+/g;
  let match;
  while ((match = tokenRegex.exec(cleanSource)) !== null) {
    const rawToken = match[0];
    if (CHORD_TOKEN_REGEX.test(rawToken)) {
      const rawPos = match.index;
      const pos = targetLyric ? snapToGraphemeCluster(rawPos, targetLyric) : rawPos;
      chords.push({
        chord: rawToken,
        position: pos,
      });
    }
  }
  return { cleanLine: cleanSource, chords };
}

/**
 * Parses inline chord notation like "Amazing [G]grace how [Em]sweet"
 */
function parseInlineChords(line) {
  let text = '';
  const chords = [];
  const regex = /\[([A-G][^\]]*)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(line)) !== null) {
    const textSegment = line.substring(lastIndex, match.index);
    text += textSegment;
    const rawChord = match[1].trim();
    if (CHORD_TOKEN_REGEX.test(rawChord)) {
      chords.push({
        chord: rawChord,
        position: snapToGraphemeCluster(text.length, text),
      });
    }
    lastIndex = match.index + match[0].length;
  }
  text += line.substring(lastIndex);
  return { text, chords };
}

/**
 * Cleans UG markup tags such as [tab], [/tab], [ch], [/ch], [b], [/b], [i], [/i]
 */
function cleanUgMarkup(text) {
  if (!text) return '';
  return text
    .replace(/\[\/?tab\]/gi, '')
    .replace(/\[\/?ch\]/gi, '')
    .replace(/\[\/?b\]/gi, '')
    .replace(/\[\/?i\]/gi, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

/**
 * UltimateGuitarParser - Converts raw UG data into wPlanner's normalised format.
 */
class UltimateGuitarParser {
  /**
   * Main parsing entry point
   *
   * @param {object} ugData - Raw UG data containing tab, tab_view, or raw text
   * @param {string} sourceUrl - Original URL
   * @returns {object} Normalised Song Object
   */
  static parse(ugData, sourceUrl = '') {
    const tab = ugData.tab || {};
    const tabView = ugData.tab_view || {};
    const wikiTab = tabView.wiki_tab || {};
    const meta = tabView.meta || {};

    const rawTitle = tab.song_name || tabView.song_name || ugData.title || 'Untitled Song';
    const rawArtist = tab.artist_name || tabView.artist_name || ugData.artist || 'Unknown Artist';
    const rawKey = meta.tonality || tab.key || ugData.key || 'C';
    const rawCapo = meta.capo !== undefined ? parseInt(meta.capo, 10) : (ugData.capo || 0);
    const rawTuning = (meta.tuning && meta.tuning.name) ? meta.tuning.name : (ugData.tuning || 'Standard');
    const rawBpm = meta.bpm ? parseInt(meta.bpm, 10) : (tab.bpm ? parseInt(tab.bpm, 10) : undefined);

    const rawContent = wikiTab.content || ugData.content || ugData.rawContent || '';

    const { sections, chordsContent, lyricsContent } = this.parseContent(rawContent);

    return {
      title: rawTitle.trim(),
      artist: rawArtist.trim(),
      key: normalizeKey(rawKey),
      bpm: rawBpm && !isNaN(rawBpm) ? rawBpm : undefined,
      timeSignature: '4/4',
      capo: isNaN(rawCapo) ? 0 : rawCapo,
      tuning: rawTuning,
      source: {
        type: 'external',
        provider: 'ultimate_guitar',
        url: sourceUrl,
        importedAt: new Date(),
      },
      content: {
        chords: chordsContent,
        lyrics: lyricsContent,
        tabs: '',
      },
      sections,
    };
  }

  /**
   * Parses raw UG text lines into structured sections and unified chords/lyrics text.
   */
  static parseContent(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') {
      return { sections: [], chordsContent: '', lyricsContent: '' };
    }

    const lines = rawContent.split(/\r?\n/);
    const sections = [];
    const formattedChordsLines = [];
    const lyricsOnlyLines = [];

    let currentSection = {
      sectionId: 'sec_0',
      name: 'Intro',
      type: 'intro',
      lines: [],
    };
    let sectionCount = 0;

    const finalizeCurrentSection = () => {
      if (currentSection.lines.length > 0) {
        sections.push({
          sectionId: currentSection.sectionId,
          name: currentSection.name,
          type: currentSection.type,
          lines: [...currentSection.lines],
        });
      }
    };

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Strip [tab] and [/tab] markup immediately from the line
      line = line.replace(/\[\/?tab\]/gi, '');
      const trimmed = line.trim();

      // Blank line handling (including lines that only contained [tab] or [/tab])
      if (!trimmed) {
        if (formattedChordsLines.length > 0 && formattedChordsLines[formattedChordsLines.length - 1] !== '') {
          formattedChordsLines.push('');
        }
        continue;
      }

      // Check for section header (e.g. [Verse 1], [Chorus], [Prelude], [Pallavi])
      if (isSectionHeading(trimmed)) {
        finalizeCurrentSection();
        sectionCount++;
        const rawSecName = trimmed.replace(/[\[\]\(\)]/g, '').replace(/:$/, '').trim();
        currentSection = {
          sectionId: `sec_${sectionCount}_${rawSecName.toLowerCase().replace(/\s+/g, '_')}`,
          name: rawSecName,
          type: classifySection(rawSecName),
          lines: [],
        };
        formattedChordsLines.push(`[${rawSecName}]`);
        continue;
      }

      // Check for inline chord-pro format: "Amazing [G]grace"
      if (/\[[A-G][^\]]*\]/.test(line) && !isSectionHeading(trimmed)) {
        const parsed = parseInlineChords(line);
        currentSection.lines.push(parsed);
        formattedChordsLines.push(line);
        lyricsOnlyLines.push(parsed.text);
        continue;
      }

      // Check if line contains chords (either [ch] tags or chord tokens)
      const hasUgChords = /\[ch\]/i.test(line);
      const isChordRow = hasUgChords || isPlainChordLine(line);

      if (isChordRow) {
        // Look ahead for the next lyric line, skipping any blank lines or standalone [tab] tags
        let nextLineIdx = i + 1;
        while (nextLineIdx < lines.length && !lines[nextLineIdx].replace(/\[\/?tab\]/gi, '').trim()) {
          nextLineIdx++;
        }

        const nextLineRaw = lines[nextLineIdx] || '';
        const nextLineCleaned = nextLineRaw.replace(/\[\/?tab\]/gi, '');
        const nextTrimmed = nextLineCleaned.trim();

        // If a lyric line follows
        const nextIsLyric =
          nextTrimmed &&
          !isSectionHeading(nextTrimmed) &&
          !/\[ch\]/i.test(nextLineCleaned) &&
          !isPlainChordLine(nextLineCleaned);

        if (nextIsLyric) {
          const lyricText = cleanUgMarkup(nextLineCleaned).trimEnd();
          const { cleanLine, chords } = parseChordLine(line, lyricText);

          currentSection.lines.push({
            text: lyricText,
            chords,
          });

          formattedChordsLines.push(cleanLine);
          formattedChordsLines.push(lyricText);
          lyricsOnlyLines.push(lyricText);
          i = nextLineIdx; // Advance past the paired lyric line
        } else {
          // Standalone chord line (Intro, Instrumental, Outro, etc.)
          const { cleanLine, chords } = parseChordLine(line, '');
          currentSection.lines.push({
            text: '',
            chords,
          });
          formattedChordsLines.push(cleanLine);
        }
        continue;
      }

      // Standalone lyric line (no chords on this line)
      const cleanLyric = cleanUgMarkup(line).trimEnd();
      if (cleanLyric) {
        currentSection.lines.push({
          text: cleanLyric,
          chords: [],
        });
        formattedChordsLines.push(cleanLyric);
        lyricsOnlyLines.push(cleanLyric);
      }
    }

    finalizeCurrentSection();

    return {
      sections,
      chordsContent: formattedChordsLines.join('\n').trim(),
      lyricsContent: lyricsOnlyLines.join('\n').trim(),
    };
  }
}

module.exports = {
  UltimateGuitarParser,
  normalizeKey,
  classifySection,
  parseChordLine,
  parseInlineChords,
  cleanUgMarkup,
  isSectionHeading,
};
