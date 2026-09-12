/**
 * Typo similarity helper utility
 */
function normalizeStr(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

function getBigrams(str) {
  const s = ` ${str} `;
  const bigrams = new Set();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.substring(i, i + 2));
  }
  return bigrams;
}

function diceCoefficient(s1, s2) {
  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;
  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let intersection = 0;
  for (const item of b1) {
    if (b2.has(item)) intersection++;
  }
  return (2 * intersection) / (b1.size + b2.size);
}

function calculateTypoSimilarity(query, target) {
  const q = normalizeStr(query);
  const t = normalizeStr(target);
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (t.includes(q) || q.includes(t)) {
    const minLen = Math.min(q.length, t.length);
    const maxLen = Math.max(q.length, t.length);
    return Math.max(0.8, minLen / maxLen);
  }
  const maxLen = Math.max(q.length, t.length);
  const editSim = 1 - levenshteinDistance(q, t) / maxLen;
  const diceSim = diceCoefficient(q, t);
  return Math.max(editSim, diceSim);
}

module.exports = {
  calculateTypoSimilarity,
  normalizeStr,
  levenshteinDistance,
  diceCoefficient,
};
