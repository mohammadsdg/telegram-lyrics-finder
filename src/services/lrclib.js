const REQUEST_TIMEOUT_MS = 10_000;

export class LyricsServiceError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'LyricsServiceError';
  }
}

export function createLrclibClient({ baseUrl, userAgent }) {
  return {
    async search(title, artist) {
      const url = new URL('/api/search', baseUrl);
      url.searchParams.set('track_name', title);
      url.searchParams.set('artist_name', artist);

      let response;
      try {
        response = await fetch(url, {
          headers: { 'User-Agent': userAgent, Accept: 'application/json' },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        });
      } catch (error) {
        throw new LyricsServiceError('The lyrics provider could not be reached.', error);
      }

      if (response.status === 404) return [];
      if (!response.ok) {
        throw new LyricsServiceError(`The lyrics provider returned HTTP ${response.status}.`);
      }

      let records;
      try {
        records = await response.json();
      } catch (error) {
        throw new LyricsServiceError('The lyrics provider returned invalid JSON.', error);
      }
      if (!Array.isArray(records)) {
        throw new LyricsServiceError('The lyrics provider returned an unexpected response.');
      }

      return records.map((record) => ({
        providerId: Number(record.id),
        trackName: String(record.trackName || record.name || ''),
        artistName: String(record.artistName || ''),
        albumName: record.albumName ? String(record.albumName) : null,
        duration: Number.isFinite(record.duration) ? Math.round(record.duration) : null,
        instrumental: Boolean(record.instrumental),
        plainLyrics: record.plainLyrics || null,
        syncedLyrics: record.syncedLyrics || null
      })).filter((record) => Number.isSafeInteger(record.providerId) && record.trackName && record.artistName);
    }
  };
}
