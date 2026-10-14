const SAFE_CHUNK_SIZE = 3900;

export function extractAudioMetadata(message) {
  const media = message.audio
    || (message.document?.mime_type?.startsWith('audio/') ? message.document : null);
  if (!media) return null;

  const filename = media.file_name || '';
  const fallbackTitle = filename.replace(/\.[^.]+$/, '').trim();
  const title = media.title?.trim() || fallbackTitle;
  const artist = media.performer?.trim();

  return {
    fileUniqueId: media.file_unique_id,
    title,
    artist,
    hasEmbeddedTitle: Boolean(media.title?.trim()),
    hasEmbeddedArtist: Boolean(artist)
  };
}

export function splitMessage(text, maxLength = SAFE_CHUNK_SIZE) {
  if (text.length <= maxLength) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf('\n\n', maxLength);
    if (splitAt < maxLength * 0.5) splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt < maxLength * 0.5) splitAt = maxLength;
    chunks.push(remaining.slice(0, splitAt).trimEnd());
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function candidateLabel(candidate) {
  const album = candidate.albumName ? ` — ${candidate.albumName}` : '';
  return `${candidate.trackName} · ${candidate.artistName}${album}`.slice(0, 64);
}

export function formatLyrics(candidate) {
  const heading = `🎵 ${candidate.trackName}\n👤 ${candidate.artistName}`
    + (candidate.albumName ? `\n💿 ${candidate.albumName}` : '');
  if (candidate.instrumental) return `${heading}\n\nThis track is marked as instrumental.`;
  const lyrics = candidate.plainLyrics || candidate.syncedLyrics;
  return lyrics ? `${heading}\n\n${lyrics.trim()}` : `${heading}\n\nNo lyrics text is available for this version.`;
}
