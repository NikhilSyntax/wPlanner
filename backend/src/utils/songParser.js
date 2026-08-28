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
  /^\s*(\[|\()?(Intro|Verse(?:\s*\d+)?|Chorus(?:\s*\d+)?|Pre-Chorus(?:\s*\d+)?|Bridge(?:\s*\d+)?|Outro|Ending|Tag|Interlude|Hook|Solo|Instrumental)(\]|\)|\:)?\s*$/i;

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
function extractChordsFromLine(chordLine, semitones = 0) {
  const chords = [];
  const tokenRegex = /\S+/g;
  let match;
  while ((match = tokenRegex.exec(chordLine)) !== null) {
    const rawToken = match[0];
    if (CHORD_TOKEN_REGEX.test(rawToken)) {
      chords.push({
        chord: transposeChord(rawToken, semitones),
        position: match.index,
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
        position: text.length,
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
  const rawLines = rawContent.split(/\r?\n/);

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
      const chords = extractChordsFromLine(line, semitones);
      const nextLine = rawLines[i + 1];

      // If next line exists and is a lyric line (not section and not chord line)
      if (nextLine && nextLine.trim() && !SECTION_REGEX.test(nextLine.trim()) && !isChordLine(nextLine)) {
        currentSection.lines.push({
          text: nextLine.trimEnd(),
          chords,
        });
        i++; // advance past the lyric line
      } else {
        // Standalone chord line (e.g. Intro/Outro/Instrumental)
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

module.exports = {
  parseSongToLiveSections,
  transposeChord,
  getSemitoneShift,
  SHARPS,
  FLATS,
  NOTE_MAP,
};
