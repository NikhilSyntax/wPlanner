const assert = require('assert');

function isCombiningCodePoint(code) {
  if (code >= 0x0300 && code <= 0x036F) return true;
  if (code >= 0x1DC0 && code <= 0x1DFF) return true;
  if (code >= 0x20D0 && code <= 0x20FF) return true;
  if (code >= 0xFE20 && code <= 0xFE2F) return true;
  if (
    (code >= 0x0900 && code <= 0x0903) || (code >= 0x093A && code <= 0x094F) || (code >= 0x0951 && code <= 0x0957) ||
    (code >= 0x0981 && code <= 0x0983) || (code >= 0x09BC && code <= 0x09CD) || code === 0x09D7 ||
    (code >= 0x0A01 && code <= 0x0A03) || (code >= 0x0A3C && code <= 0x0A4D) ||
    (code >= 0x0A81 && code <= 0x0A83) || (code >= 0x0ABC && code <= 0x0ACD) ||
    (code >= 0x0B01 && code <= 0x0B03) || (code >= 0x0B3C && code <= 0x0B4D) || (code >= 0x0B56 && code <= 0x0B57) ||
    (code >= 0x0B82 && code <= 0x0BCD) || code === 0x0BD7 ||
    (code >= 0x0C00 && code <= 0x0C03) || (code >= 0x0C3E && code <= 0x0C4D) || (code >= 0x0C55 && code <= 0x0C56) || (code >= 0x0C62 && code <= 0x0C63) ||
    (code >= 0x0C81 && code <= 0x0C83) || (code >= 0x0CBC && code <= 0x0CCD) || (code >= 0x0CD5 && code <= 0x0CD6) ||
    (code >= 0x0D00 && code <= 0x0D03) || (code >= 0x0D3B && code <= 0x0D4D) || (code >= 0x0D57 && code <= 0x0D63)
  ) {
    return true;
  }
  return false;
}

function getGraphemeClusterStartIndices(text) {
  if (!text) return [0];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const segments = Array.from(segmenter.segment(text));
    return segments.map((s) => s.index);
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

function snapToGraphemeCluster(pos, text, graphemeIndices) {
  if (pos <= 0) return 0;
  if (pos >= text.length) return text.length;
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

function buildLineWords(text = '', chords = []) {
  if (!text) {
    if (Array.isArray(chords) && chords.length > 0) {
      return [{ isSpace: false, segments: chords.map((c) => ({ chord: c.chord, text: '' })) }];
    }
    return [];
  }

  const graphemeIndices = getGraphemeClusterStartIndices(text);
  const normalizedChords = (chords || []).map((c) => ({
    chord: c.chord,
    position: snapToGraphemeCluster(c.position || 0, text, graphemeIndices),
  })).sort((a, b) => a.position - b.position);

  // Split line into words and spaces preserving exact indices
  const wordRegex = /(\s+|[^\s]+)/g;
  const words = [];
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    const wordText = match[0];
    const wStart = match.index;
    const wEnd = wStart + wordText.length;
    const isSpace = /^\s+$/.test(wordText);

    // Find chords within this token
    const tokenChords = normalizedChords.filter(
      (c) => c.position >= wStart && c.position < wEnd
    );

    if (tokenChords.length === 0) {
      words.push({
        isSpace,
        raw: wordText,
        segments: [{ chord: null, text: wordText }],
      });
      continue;
    }

    const segments = [];
    let cur = wStart;

    if (tokenChords[0].position > wStart) {
      segments.push({
        chord: null,
        text: text.substring(wStart, tokenChords[0].position),
      });
      cur = tokenChords[0].position;
    }

    for (let i = 0; i < tokenChords.length; i++) {
      const tc = tokenChords[i];
      const nextChord = tokenChords[i + 1];
      const nextPos = nextChord ? nextChord.position : wEnd;

      segments.push({
        chord: tc.chord,
        text: text.substring(tc.position, nextPos),
      });
      cur = nextPos;
    }

    if (cur < wEnd) {
      segments.push({
        chord: null,
        text: text.substring(cur, wEnd),
      });
    }

    words.push({
      isSpace,
      raw: wordText,
      segments,
    });
  }

  return words;
}

// Test with the exact Telugu lyric from user image
const sampleText = "నీటిపైనా నడిచెను - గాలి సముద్రమును గద్దించెను";
// Suppose chord Em was at index of 'ి' in 'గాలి'
const sampleChords = [
  { chord: 'C', position: 0 },
  { chord: 'Em', position: 21 }, // index of combining vowel sign
];

const words = buildLineWords(sampleText, sampleChords);
console.log('Words output:');
words.forEach((w, idx) => {
  console.log(`Word ${idx}: [${w.raw}] (isSpace: ${w.isSpace})`, w.segments);
});

// Verify no segment starts with a combining mark
words.forEach((w) => {
  w.segments.forEach((s) => {
    if (s.text) {
      const firstCode = s.text.charCodeAt(0);
      assert.strictEqual(
        isCombiningCodePoint(firstCode),
        false,
        `Segment "${s.text}" must not start with combining mark!`
      );
    }
  });
});

console.log('✅ Telugu / Indic grapheme cluster test passed perfectly!');
