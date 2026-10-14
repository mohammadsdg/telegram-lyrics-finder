import test from 'node:test';
import assert from 'node:assert/strict';
import { hasConfidentWinner, rankCandidates, similarity } from '../src/services/matching.js';

const record = (id, trackName, artistName, albumName = 'Album') => ({
  providerId: id,
  trackName,
  artistName,
  albumName,
  duration: 200,
  instrumental: false,
  plainLyrics: 'lyrics',
  syncedLyrics: null
});

test('similarity normalizes punctuation, case, accents, and featured artists', () => {
  assert.equal(similarity('Beyoncé!', 'beyonce'), 1);
  assert.equal(similarity('Song feat. Guest', 'Song'), 1);
});

test('rankCandidates puts the closest title and artist first', () => {
  const ranked = rankCandidates([
    record(1, 'Yellow Submarine', 'The Beatles'),
    record(2, 'Yellow', 'Coldplay')
  ], 'Yellow', 'Coldplay');
  assert.equal(ranked[0].providerId, 2);
  assert.equal(ranked[0].score, 1);
});

test('rankCandidates removes duplicate releases and weak matches', () => {
  const ranked = rankCandidates([
    record(1, 'Hello', 'Adele'),
    record(2, 'Hello', 'Adele'),
    record(3, 'Completely Different', 'Nobody')
  ], 'Hello', 'Adele');
  assert.deepEqual(ranked.map((item) => item.providerId), [1]);
});

test('confidence requires both a strong match and a useful lead', () => {
  assert.equal(hasConfidentWinner([{ score: 1 }]), true);
  assert.equal(hasConfidentWinner([{ score: 1 }, { score: 0.7 }]), true);
  assert.equal(hasConfidentWinner([{ score: 1 }, { score: 0.95 }]), false);
  assert.equal(hasConfidentWinner([]), false);
});
