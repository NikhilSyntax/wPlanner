// Musical notes mapping for transposition
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_MAP = {
  ...SHARPS.reduce((acc, note, idx) => ({ ...acc, [note]: idx }), {}),
  ...FLATS.reduce((acc, note, idx) => ({ ...acc, [note]: idx }), {}),
};

const CHORD_REGEX_STR =
  '([A-G][#b]?(?:m|min|maj|dim|aug|sus[24]?|add[29]?|[2-9]|11|13|maj7|m7|7|6|9|dim7)?(?:\\/[A-G][#b]?)?)';
const CHORD_TOKEN_REGEX = new RegExp(`^${CHORD_REGEX_STR}$`);

const SECTION_REGEX =
  /^\s*(\[|\()?(Intro|Verse(?:\s*\d+)?|Chorus(?:\s*\d+)?|Pre-Chorus(?:\s*\d+)?|Bridge(?:\s*\d+)?|Outro|Ending|Tag|Interlude|Hook|Solo|Instrumental|Prelude|Postlude|Pallavi(?:\s*\d+)?|Anupallavi(?:\s*\d+)?|Charanam(?:\s*\d+)?|Refrain|Stanza(?:\s*\d+)?|Coro|Estrofa(?:\s*\d+)?|Puente)(\]|\)|\:)?\s*$/i;

function isCombiningCodePoint(code) {
  if (code >= 0x0300 && code <= 0x036f) return true;
  if (code >= 0x1dc0 && code <= 0x1dff) return true;
  if (code >= 0x20d0 && code <= 0x20ff) return true;
  if (code >= 0xfe20 && code <= 0xfe2f) return true;

  if (
    (code >= 0x0900 && code <= 0x0903) || (code >= 0x093a && code <= 0x094f) || (code >= 0x0951 && code <= 0x0957) ||
    (code >= 0x0981 && code <= 0x0983) || (code >= 0x09bc && code <= 0x09cd) || code === 0x09d7 ||
    (code >= 0x0a01 && code <= 0x0a03) || (code >= 0x0a3c && code <= 0x0a4d) ||
    (code >= 0x0a81 && code <= 0x0a83) || (code >= 0x0abc && code <= 0x0acd) ||
    (code >= 0x0b01 && code <= 0x0b03) || (code >= 0x0b3c && code <= 0x0b4d) || (code >= 0x0b56 && code <= 0x0b57) ||
    (code >= 0x0b82 && code <= 0x0bcd) || code === 0x0bd7 ||
    (code >= 0x0c00 && code <= 0x0c03) || (code >= 0x0c3e && code <= 0x0c4d) || (code >= 0x0c55 && code <= 0x0c56) || (code >= 0x0c62 && code <= 0x0c63) ||
    (code >= 0x0c81 && code <= 0x0c83) || (code >= 0x0cbc && code <= 0x0ccd) || (code >= 0x0cd5 && code <= 0x0cd6) ||
    (code >= 0x0d00 && code <= 0x0d03) || (code >= 0x0d3b && code <= 0x0d4d) || (code >= 0x0d57 && code <= 0x0d63)
  ) {
    return true;
  }
  return false;
}

function getGraphemeClusterStartIndices(text) {
  if (!text) return [0];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const segments = Array.from(segmenter.segment(text));
      return segments.map((s) => s.index);
    } catch {
      // fallback
    }
  }

  const indices = [0];
  for (let i = 1; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (!isCombiningCodePoint(code)) {
      indices.push(i);
    }
  }
  return indices;
}

function snapToGraphemeCluster(pos, text) {
  if (pos <= 0) return 0;
  if (!text || pos >= text.length) return text ? text.length : pos;

  const graphemeIndices = getGraphemeClusterStartIndices(text);
  if (graphemeIndices.includes(pos)) return pos;

  let best = 0;
  for (const idx of graphemeIndices) {
    if (idx <= pos) {
      best = idx;
    } else {
      break;
    }
  }
  return best;
}

function getSemitoneShift(fromKey, toKey) {
  if (!fromKey || !toKey) return 0;
  const fromIdx = NOTE_MAP[fromKey];
  const toIdx = NOTE_MAP[toKey];
  if (fromIdx === undefined || toIdx === undefined) return 0;
  let diff = toIdx - fromIdx;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

function transposeChord(chord, semitones) {
  if (!chord || semitones === 0) return chord;
  const [rootPart, bassPart] = chord.split('/');
  const match = rootPart.match(/^([A-G])([#b]?)(.*)$/);
  if (!match) return chord;

  const [, base, accidental, suffix] = match;
  const noteName = base + accidental;
  let idx = NOTE_MAP[noteName];
  if (idx === undefined) return chord;

  idx = (idx + semitones) % 12;
  if (idx < 0) idx += 12;
  const newRoot = SHARPS[idx];

  let newBass = '';
  if (bassPart) {
    const bassMatch = bassPart.match(/^([A-G])([#b]?)(.*)$/);
    if (bassMatch) {
      const [, bBase, bAccidental, bSuffix] = bassMatch;
      let bIdx = NOTE_MAP[bBase + bAccidental];
      if (bIdx !== undefined) {
        bIdx = (bIdx + semitones) % 12;
        if (bIdx < 0) bIdx += 12;
        newBass = '/' + SHARPS[bIdx] + (bSuffix || '');
      } else {
        newBass = '/' + bassPart;
      }
    } else {
      newBass = '/' + bassPart;
    }
  }

  return newRoot + suffix + newBass;
}

function isChordLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (SECTION_REGEX.test(trimmed)) return false;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  let chordCount = 0;
  for (const token of tokens) {
    if (CHORD_TOKEN_REGEX.test(token)) {
      chordCount++;
    }
  }
  return chordCount / tokens.length >= 0.65;
}

/**
 * Extract chords and their character column positions from a chord line
 */
function extractChordsFromLine(chordLine, semitones = 0, targetLyricText = '') {
  const chords = [];
  const tokenRegex = /\S+/g;
  let match;
  while ((match = tokenRegex.exec(chordLine)) !== null) {
    const rawToken = match[0];
    if (CHORD_TOKEN_REGEX.test(rawToken)) {
      const rawPos = match.index;
      const snappedPos = targetLyricText ? snapToGraphemeCluster(rawPos, targetLyricText) : rawPos;
      chords.push({
        chord: transposeChord(rawToken, semitones),
        position: snappedPos,
      });
    }
  }
  return chords;
}

/**
 * Parse inline chord-pro format: "Amazing [G]grace how [Em]sweet"
 */
function parseInlineChordPro(line, semitones = 0) {
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
        chord: transposeChord(rawChord, semitones),
        position: snapToGraphemeCluster(text.length, text),
      });
    }
    lastIndex = match.index + match[0].length;
  }
  text += line.substring(lastIndex);

  return { text, chords };
}

/**
 * Parse raw song text into structured sections and 2-line presentation chunks
 *
 * @param {string} rawContent - Song chords/lyrics text
 * @param {string} originalKey - Master song key
 * @param {string} targetKey - Event transposition key
 * @returns {Array} List of structured sections with 2-line chunks
 */
function parseSongToLiveSections(rawContent = '', originalKey = 'C', targetKey = 'C') {
  if (!rawContent || typeof rawContent !== 'string') {
    return [];
  }

  const semitones = getSemitoneShift(originalKey, targetKey);
  const cleanContent = (rawContent || '').replace(/\[\/?tab\]/gi, '');
  const rawLines = cleanContent.split(/\r?\n/);

  const sections = [];
  let currentSection = {
    sectionId: 'sec_0',
    name: 'Section 1',
    lines: [],
  };

  let sectionCounter = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    // Check for section header
    const secMatch = trimmed.match(SECTION_REGEX);
    if (secMatch) {
      if (currentSection.lines.length > 0) {
        sections.push(finalizeSection(currentSection));
      }
      sectionCounter++;
      const sectionName = secMatch[2] || trimmed.replace(/[\[\]\(\)]/g, '').trim();
      currentSection = {
        sectionId: `sec_${sectionCounter}_${sectionName.toLowerCase().replace(/\s+/g, '_')}`,
        name: sectionName,
        lines: [],
      };
      continue;
    }

    // Check for inline chord-pro format: e.g. "Amazing [G]grace"
    if (/\[[A-G][^\]]*\]/.test(line) && !SECTION_REGEX.test(line)) {
      const parsed = parseInlineChordPro(line, semitones);
      currentSection.lines.push(parsed);
      continue;
    }

    // Check if this line is a standalone chord line
    if (isChordLine(line)) {
      const nextLine = rawLines[i + 1];

      // If next line exists and is a lyric line (not section and not chord line)
      if (nextLine && nextLine.trim() && !SECTION_REGEX.test(nextLine.trim()) && !isChordLine(nextLine)) {
        const lyricText = nextLine.trimEnd();
        const chords = extractChordsFromLine(line, semitones, lyricText);
        currentSection.lines.push({
          text: lyricText,
          chords,
        });
        i++; // advance past the lyric line
      } else {
        // Standalone chord line (e.g. Intro/Outro/Instrumental)
        const chords = extractChordsFromLine(line, semitones, '');
        currentSection.lines.push({
          text: '',
          chords,
        });
      }
      continue;
    }

    // Regular lyric line without separate chords
    currentSection.lines.push({
      text: line.trimEnd(),
      chords: [],
    });
  }

  if (currentSection.lines.length > 0) {
    sections.push(finalizeSection(currentSection));
  }

  return sections;
}

/**
 * Breaks a section's lines into 2-line chunks for live presentation
 */
function finalizeSection(section) {
  const chunks = [];
  const lines = section.lines;

  for (let i = 0; i < lines.length; i += 2) {
    const chunkLines = lines.slice(i, i + 2);
    chunks.push({
      chunkIndex: Math.floor(i / 2),
      lines: chunkLines,
    });
  }

  return {
    sectionId: section.sectionId,
    name: section.name,
    lines: section.lines,
    chunks: chunks.length > 0 ? chunks : [{ chunkIndex: 0, lines: [{ text: '', chords: [] }] }],
  };
}

function transposeLine(line, semitones) {
  if (semitones === 0 || !line) return line;

  // 1. Handle [ch]...[/ch] tags
  if (/\[ch\]/.test(line)) {
    return line.replace(/\[ch\](.*?)\[\/ch\]/g, (match, chord) => {
      return '[ch]' + transposeChord(chord, semitones) + '[/ch]';
    });
  }

  // 2. Handle [G] inline bracket chords
  if (/\[[A-G][#b]?[^\]]*\]/.test(line) && !SECTION_REGEX.test(line.trim())) {
    return line.replace(/\[([A-G][#b]?[^\]]*)\]/g, (match, chord) => {
      if (CHORD_TOKEN_REGEX.test(chord)) {
        return '[' + transposeChord(chord, semitones) + ']';
      }
      return match;
    });
  }

  // 3. Handle standalone chord line
  if (isChordLine(line)) {
    const regex = /([^\s]+|\s+)/g;
    let match;
    const tokens = [];
    while ((match = regex.exec(line)) !== null) {
      const item = match[0];
      if (/^\s+$/.test(item)) {
        tokens.push({ type: 'space', text: item });
      } else if (CHORD_TOKEN_REGEX.test(item)) {
        const transposed = transposeChord(item, semitones);
        tokens.push({ type: 'chord', original: item, text: transposed });
      } else {
        tokens.push({ type: 'text', text: item });
      }
    }

    // Preserve column alignment
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === 'chord') {
        const diff = token.text.length - token.original.length;
        if (diff !== 0 && i + 1 < tokens.length && tokens[i + 1].type === 'space') {
          const spaceToken = tokens[i + 1];
          if (diff > 0) {
            spaceToken.text = spaceToken.text.substring(Math.min(diff, spaceToken.text.length - 1));
          } else {
            spaceToken.text = ' '.repeat(Math.abs(diff)) + spaceToken.text;
          }
        }
      }
    }

    return tokens.map((t) => t.text).join('');
  }

  return line;
}

/**
 * Transposes all chords in a raw chord sheet text from one key to another.
 *
 * @param {string} rawContent - The chord sheet text
 * @param {string} fromKey - Original key (e.g. 'G')
 * @param {string} toKey - Target key (e.g. 'D')
 * @returns {string} The transposed chord sheet text
 */
function transposeChordsText(rawContent, fromKey, toKey) {
  if (!rawContent || typeof rawContent !== 'string') return rawContent;
  const semitones = getSemitoneShift(fromKey, toKey);
  if (semitones === 0) return rawContent;

  const lines = rawContent.split(/\r?\n/);
  const transposedLines = lines.map((line) => transposeLine(line, semitones));
  return transposedLines.join('\n');
}

module.exports = {
  parseSongToLiveSections,
  transposeChord,
  transposeChordsText,
  transposeLine,
  getSemitoneShift,
  snapToGraphemeCluster,
  SHARPS,
  FLATS,
  NOTE_MAP,
};
