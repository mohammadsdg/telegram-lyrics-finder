CREATE DATABASE IF NOT EXISTS lyrics_bot
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lyrics_bot;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  telegram_user_id BIGINT NOT NULL,
  username VARCHAR(255) NULL,
  first_name VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_telegram_user_id (telegram_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lyrics_cache (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(32) NOT NULL DEFAULT 'lrclib',
  provider_lyrics_id BIGINT NOT NULL,
  track_name VARCHAR(500) NOT NULL,
  artist_name VARCHAR(500) NOT NULL,
  album_name VARCHAR(500) NULL,
  duration_seconds INT NULL,
  instrumental BOOLEAN NOT NULL DEFAULT FALSE,
  plain_lyrics MEDIUMTEXT NULL,
  synced_lyrics MEDIUMTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lyrics_provider_id (provider, provider_lyrics_id),
  KEY ix_lyrics_artist_track (artist_name(191), track_name(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lookup_requests (
  id CHAR(36) NOT NULL,
  telegram_user_id BIGINT NOT NULL,
  telegram_chat_id BIGINT NOT NULL,
  telegram_message_id BIGINT NOT NULL,
  source_file_unique_id VARCHAR(255) NOT NULL,
  requested_title VARCHAR(500) NOT NULL,
  requested_artist VARCHAR(500) NOT NULL,
  status ENUM('processing', 'awaiting_choice', 'completed', 'not_found', 'failed') NOT NULL DEFAULT 'processing',
  selected_lyrics_id BIGINT UNSIGNED NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_lookup_owner_expiry (telegram_user_id, expires_at),
  CONSTRAINT fk_lookup_selected_lyrics FOREIGN KEY (selected_lyrics_id) REFERENCES lyrics_cache(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lookup_candidates (
  lookup_id CHAR(36) NOT NULL,
  position TINYINT UNSIGNED NOT NULL,
  lyrics_id BIGINT UNSIGNED NOT NULL,
  match_score DECIMAL(5,4) NOT NULL,
  PRIMARY KEY (lookup_id, position),
  UNIQUE KEY uq_lookup_lyrics (lookup_id, lyrics_id),
  CONSTRAINT fk_candidate_lookup FOREIGN KEY (lookup_id) REFERENCES lookup_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_candidate_lyrics FOREIGN KEY (lyrics_id) REFERENCES lyrics_cache(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
