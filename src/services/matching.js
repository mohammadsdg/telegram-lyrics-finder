function normalize(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(feat|ft|featuring)\.?\b.*$/u, '')
    .replace(/\([^)]*(remaster|live|version|edit|mix)[^)]*\)/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function bigrams(value) {
  const compact = ` ${normalize(value)} `;
  const result = [];
  for (let index = 0; index < compact.length - 1; index += 1) {
    result.push(compact.slice(index, index + 2));
  }
  return result;
}

export function similarity(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const leftPairs = bigrams(a);
  const rightPairs = bigrams(b);
  const rightCounts = new Map();
  for (const pair of rightPairs) {
    rightCounts.set(pair, (rightCounts.get(pair) || 0) + 1);
  }

  let overlap = 0;
  for (const pair of leftPairs) {
    const count = rightCounts.get(pair) || 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(pair, count - 1);
    }
  }
  return (2 * overlap) / (leftPairs.length + rightPairs.length);
}

export function rankCandidates(records, requestedTitle, requestedArtist, limit = 5) {
  const seen = new Set();
  return records
    .map((record) => ({
      ...record,
      score: (similarity(record.trackName, requestedTitle) * 0.65)
        + (similarity(record.artistName, requestedArtist) * 0.35)
    }))
    .sort((a, b) => b.score - a.score)
    .filter((record) => {
      const key = `${normalize(record.trackName)}::${normalize(record.artistName)}::${normalize(record.albumName || '')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return record.score >= 0.45;
    })
    .slice(0, limit);
}

export function hasConfidentWinner(candidates) {
  if (candidates.length <= 1) return candidates.length === 1;
  return candidates[0].score >= 0.92 && candidates[0].score - candidates[1].score >= 0.12;
}
