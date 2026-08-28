import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Check if a Unicode character / code point is a combining diacritical mark,
 * Indic vowel sign (matra), virama, anusvara, or visarga.
 */
function isCombiningCodePoint(code) {
  // General combining diacritics
  if (code >= 0x0300 && code <= 0x036f) return true;
  if (code >= 0x1dc0 && code <= 0x1dff) return true;
  if (code >= 0x20d0 && code <= 0x20ff) return true;
  if (code >= 0xfe20 && code <= 0xfe2f) return true;

  // Indic scripts (Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam, etc.)
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

/**
 * Returns grapheme cluster start boundaries so we never slice a combining mark away from its base character.
 */
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

/**
 * Snaps a chord position to a valid grapheme cluster start index.
 */
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

/**
 * Splits line text into Word blocks and grapheme-safe chord segments.
 * Word-level grouping guarantees words never split across line wraps.
 */
function buildLineWords(text = '', chords = []) {
  if (!text) {
    if (Array.isArray(chords) && chords.length > 0) {
      return [{ isSpace: false, segments: chords.map((c) => ({ chord: c.chord, text: '' })) }];
    }
    return [];
  }

  const graphemeIndices = getGraphemeClusterStartIndices(text);
  const normalizedChords = (chords || [])
    .map((c) => ({
      chord: c.chord,
      position: snapToGraphemeCluster(c.position || 0, text, graphemeIndices),
    }))
    .sort((a, b) => a.position - b.position);

  // Tokenize line into words and whitespace
  const wordRegex = /(\s+|[^\s]+)/g;
  const words = [];
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    const wordText = match[0];
    const wStart = match.index;
    const wEnd = wStart + wordText.length;
    const isSpace = /^\s+$/.test(wordText);

    // Chords falling within this word token
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

const INDIC_FONT_FAMILY =
  '"Noto Sans Telugu", "Gautami", "Vani", "Tiro Telugu", "Noto Sans Devanagari", "Mukta", "Noto Sans Tamil", "Outfit", "Inter", -apple-system, sans-serif';

/**
 * AnchoredLyricRow - Renders lyric line with Unicode grapheme-cluster-safe anchored chords.
 * Preserves Telugu and Indic matras, virama, and words seamlessly.
 */
export default function AnchoredLyricRow({
  line = { text: '', chords: [] },
  showChords = true,
  fontSize = '2.4rem',
  chordColor = '#38bdf8',
  textColor = '#ffffff',
  align = 'left',
  isPureChordsOnly = false,
}) {
  const rawText = line?.text || '';
  const chords = line?.chords || [];
  const words = buildLineWords(rawText, chords);

  // If there is no lyric text at all (e.g. [Intro] or Instrumental chords)
  if (!rawText.trim() && chords.length > 0) {
    if (!showChords) return null;
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          flexWrap: 'wrap',
          gap: { xs: 2, sm: 3, md: 4 },
          my: 1.5,
          width: '100%',
        }}
      >
        {chords.map((c, idx) => (
          <Typography
            key={idx}
            component="span"
            sx={{
              fontFamily: INDIC_FONT_FAMILY,
              fontWeight: 800,
              fontSize: `calc(${fontSize} * 0.9)`,
              color: chordColor,
              letterSpacing: '0.05em',
            }}
          >
            {c.chord}
          </Typography>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        textAlign: align,
        lineHeight: 1.25,
        my: { xs: 0.75, sm: 1.25 },
        whiteSpace: 'pre-wrap',
        wordBreak: 'normal',
        width: '100%',
      }}
    >
      {words.map((word, wIdx) => {
        // Space / whitespace token
        if (word.isSpace) {
          const spaceChord = word.segments.find((s) => s.chord)?.chord;
          const hasSpaceChord = Boolean(spaceChord) && showChords && !isPureChordsOnly;

          return (
            <Box
              key={wIdx}
              component="span"
              sx={{
                display: 'inline-flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                verticalAlign: 'bottom',
              }}
            >
              {showChords && (
                <Box
                  component="span"
                  sx={{
                    fontFamily: INDIC_FONT_FAMILY,
                    fontWeight: 900,
                    fontSize: `calc(${fontSize} * 0.7)`,
                    color: chordColor,
                    minHeight: '1.2em',
                    lineHeight: 1.1,
                    userSelect: 'none',
                    whiteSpace: 'pre',
                  }}
                >
                  {hasSpaceChord ? spaceChord : '\u00A0'}
                </Box>
              )}
              <Typography
                component="span"
                sx={{
                  fontFamily: INDIC_FONT_FAMILY,
                  fontWeight: 600,
                  fontSize,
                  color: textColor,
                  lineHeight: 1.2,
                  whiteSpace: 'pre',
                }}
              >
                {word.raw}
              </Typography>
            </Box>
          );
        }

        // Standard Word Token (Wrapped in nowrap so word never breaks across lines)
        return (
          <Box
            key={wIdx}
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'flex-end',
              whiteSpace: 'nowrap',
              verticalAlign: 'bottom',
            }}
          >
            {word.segments.map((seg, sIdx) => {
              const hasChord = Boolean(seg.chord) && showChords && !isPureChordsOnly;

              return (
                <Box
                  key={sIdx}
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    verticalAlign: 'bottom',
                  }}
                >
                  {/* Chord Header positioned directly over starting character */}
                  {showChords && (
                    <Box
                      component="span"
                      sx={{
                        fontFamily: INDIC_FONT_FAMILY,
                        fontWeight: 900,
                        fontSize: `calc(${fontSize} * 0.7)`,
                        color: chordColor,
                        minHeight: '1.2em',
                        lineHeight: 1.1,
                        letterSpacing: '0.04em',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        pr: 0.25,
                        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                      }}
                    >
                      {hasChord ? seg.chord : '\u00A0'}
                    </Box>
                  )}

                  {/* Lyric Text Characters */}
                  <Typography
                    component="span"
                    sx={{
                      fontFamily: INDIC_FONT_FAMILY,
                      fontWeight: 600,
                      fontSize,
                      color: textColor,
                      lineHeight: 1.2,
                      letterSpacing: '0.01em',
                      whiteSpace: 'pre',
                    }}
                  >
                    {seg.text || (hasChord ? '\u00A0' : '')}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
