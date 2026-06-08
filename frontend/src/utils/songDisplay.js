export function songsByIdMap(songs) {
  return new Map((songs || []).map((s) => [String(s._id), s]));
}

/** Prefer song-bank fields (e.g. timeSignature) over partial setlist snapshots. */
export function mergeSongWithBank(song, bankById) {
  if (!song || typeof song !== 'object') return song;
  const id = String(song._id || song);
  const fromBank = bankById?.get(id);
  if (!fromBank) return song;

  return {
    ...fromBank,
    ...song,
    title: song.title ?? fromBank.title,
    artist: song.artist ?? fromBank.artist,
    key: song.key ?? fromBank.key,
    timeSignature: fromBank.timeSignature ?? song.timeSignature,
  };
}

export function mergeSetlistWithBank(setlist, songs) {
  const bankById = songsByIdMap(songs);
  return (setlist || []).map((item) => mergeSongWithBank(item, bankById));
}
