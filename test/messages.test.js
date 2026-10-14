import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAudioMetadata, splitMessage } from '../src/utils/messages.js';

test('extractAudioMetadata reads Telegram title and performer', () => {
  assert.deepEqual(extractAudioMetadata({
    audio: {
      file_unique_id: 'abc', file_name: 'fallback.mp3', title: 'Song', performer: 'Artist'
    }
  }), {
    fileUniqueId: 'abc', title: 'Song', artist: 'Artist',
    hasEmbeddedTitle: true, hasEmbeddedArtist: true
  });
});

test('filename is only a title fallback and does not pretend tags exist', () => {
  const metadata = extractAudioMetadata({
    document: { file_unique_id: 'abc', file_name: 'Song.mp3', mime_type: 'audio/mpeg' }
  });
  assert.equal(metadata.title, 'Song');
  assert.equal(metadata.hasEmbeddedTitle, false);
  assert.equal(metadata.hasEmbeddedArtist, false);
});

test('splitMessage keeps every chunk below the requested size', () => {
  const input = `${'first line\n'.repeat(30)}${'x'.repeat(150)}`;
  const chunks = splitMessage(input, 100);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 100));
});
