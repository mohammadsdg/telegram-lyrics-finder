import mysql from 'mysql2/promise';

export function createDatabase(config) {
  const pool = mysql.createPool({
    ...config,
    waitForConnections: true,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: true
  });

  return {
    pool,

    async ping() {
      await pool.query('SELECT 1');
    },

    async upsertUser(user) {
      await pool.execute(
        `INSERT INTO users (telegram_user_id, username, first_name)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE username = VALUES(username), first_name = VALUES(first_name)`,
        [String(user.id), user.username ?? null, user.first_name ?? null]
      );
    },

    async createLookup(lookup) {
      await pool.execute(
        `INSERT INTO lookup_requests
          (id, telegram_user_id, telegram_chat_id, telegram_message_id,
           source_file_unique_id, requested_title, requested_artist, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`,
        [lookup.id, String(lookup.userId), String(lookup.chatId), String(lookup.messageId),
          lookup.fileUniqueId, lookup.title, lookup.artist, lookup.ttlMinutes]
      );
    },

    async saveCandidates(lookupId, candidates) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const stored = [];
        for (const candidate of candidates) {
          await connection.execute(
            `INSERT INTO lyrics_cache
              (provider, provider_lyrics_id, track_name, artist_name, album_name,
               duration_seconds, instrumental, plain_lyrics, synced_lyrics)
             VALUES ('lrclib', ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               id = LAST_INSERT_ID(id), track_name = VALUES(track_name),
               artist_name = VALUES(artist_name), album_name = VALUES(album_name),
               duration_seconds = VALUES(duration_seconds), instrumental = VALUES(instrumental),
               plain_lyrics = VALUES(plain_lyrics), synced_lyrics = VALUES(synced_lyrics)`,
            [candidate.providerId, candidate.trackName, candidate.artistName,
              candidate.albumName, candidate.duration, candidate.instrumental,
              candidate.plainLyrics, candidate.syncedLyrics]
          );
          const [[row]] = await connection.execute(
            `SELECT id FROM lyrics_cache WHERE provider = 'lrclib' AND provider_lyrics_id = ?`,
            [candidate.providerId]
          );
          stored.push({ ...candidate, databaseId: String(row.id) });
        }
        await connection.execute('DELETE FROM lookup_candidates WHERE lookup_id = ?', [lookupId]);
        for (let index = 0; index < stored.length; index += 1) {
          await connection.execute(
            `INSERT INTO lookup_candidates (lookup_id, position, lyrics_id, match_score)
             VALUES (?, ?, ?, ?)`,
            [lookupId, index, stored[index].databaseId, stored[index].score]
          );
        }
        await connection.execute(
          `UPDATE lookup_requests
           SET status = ?, selected_lyrics_id = ?
           WHERE id = ?`,
          [stored.length > 1 ? 'awaiting_choice' : 'completed',
            stored.length === 1 ? stored[0].databaseId : null, lookupId]
        );
        await connection.commit();
        return stored;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async setLookupStatus(lookupId, status) {
      await pool.execute('UPDATE lookup_requests SET status = ? WHERE id = ?', [status, lookupId]);
    },

    async selectCandidate(lookupId, position, userId) {
      const [[row]] = await pool.execute(
        `SELECT r.status, r.expires_at, c.lyrics_id, l.track_name, l.artist_name,
                l.album_name, l.instrumental, l.plain_lyrics, l.synced_lyrics
         FROM lookup_requests r
         JOIN lookup_candidates c ON c.lookup_id = r.id AND c.position = ?
         JOIN lyrics_cache l ON l.id = c.lyrics_id
         WHERE r.id = ? AND r.telegram_user_id = ?`,
        [position, lookupId, String(userId)]
      );
      if (!row) return { kind: 'missing' };
      if (new Date(row.expires_at).getTime() < Date.now()) return { kind: 'expired' };
      if (row.status !== 'awaiting_choice') return { kind: 'unavailable' };

      const [update] = await pool.execute(
        `UPDATE lookup_requests
         SET status = 'completed', selected_lyrics_id = ?
         WHERE id = ? AND status = 'awaiting_choice'`,
        [row.lyrics_id, lookupId]
      );
      if (update.affectedRows !== 1) return { kind: 'unavailable' };
      return {
        kind: 'ok',
        candidate: {
          trackName: row.track_name,
          artistName: row.artist_name,
          albumName: row.album_name,
          instrumental: Boolean(row.instrumental),
          plainLyrics: row.plain_lyrics,
          syncedLyrics: row.synced_lyrics
        }
      };
    },

    async close() {
      await pool.end();
    }
  };
}
