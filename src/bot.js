import { randomUUID } from 'node:crypto';
import { Markup, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { rankCandidates, hasConfidentWinner } from './services/matching.js';
import {
  candidateLabel, extractAudioMetadata, formatLyrics, splitMessage
} from './utils/messages.js';

const CHOICE_PATTERN = /^lyrics:([0-9a-f-]{36}):(\d)$/;

async function sendLyrics(ctx, candidate) {
  const chunks = splitMessage(formatLyrics(candidate));
  for (const chunk of chunks) await ctx.reply(chunk);
}

export function createBot({ token, database, lyricsClient, choiceTtlMinutes, logger }) {
  const bot = new Telegraf(token);

  bot.start((ctx) => ctx.reply(
    'Send me a Telegram audio file with song title and performer metadata. '
    + 'I will look up its lyrics. If several versions match, I will ask you to choose.'
  ));

  bot.help((ctx) => ctx.reply(
    'Send a song as an audio file (not a voice note). The file must include both Title and Performer tags. '
    + 'Telegram displays these above the audio player.'
  ));

  bot.on(message('audio'), handleAudio);
  bot.on(message('document'), async (ctx, next) => {
    if (ctx.message.document.mime_type?.startsWith('audio/')) return handleAudio(ctx);
    return next();
  });

  async function handleAudio(ctx) {
    const metadata = extractAudioMetadata(ctx.message);
    if (!metadata) return;
    if (!metadata.hasEmbeddedTitle || !metadata.hasEmbeddedArtist) {
      await ctx.reply(
        'I need both the song title and performer from the audio metadata. '
        + 'Please edit the file tags and send it again.'
      );
      return;
    }

    const lookupId = randomUUID();
    try {
      await ctx.sendChatAction('typing');
      await database.upsertUser(ctx.from);
      await database.createLookup({
        id: lookupId,
        userId: ctx.from.id,
        chatId: ctx.chat.id,
        messageId: ctx.message.message_id,
        fileUniqueId: metadata.fileUniqueId,
        title: metadata.title,
        artist: metadata.artist,
        ttlMinutes: choiceTtlMinutes
      });

      const results = await lyricsClient.search(metadata.title, metadata.artist);
      const candidates = rankCandidates(results, metadata.title, metadata.artist);
      if (!candidates.length) {
        await database.setLookupStatus(lookupId, 'not_found');
        await ctx.reply(`I could not find lyrics for “${metadata.title}” by ${metadata.artist}.`);
        return;
      }

      const choices = hasConfidentWinner(candidates) ? [candidates[0]] : candidates;
      const stored = await database.saveCandidates(lookupId, choices);
      if (stored.length === 1) {
        await sendLyrics(ctx, stored[0]);
        return;
      }

      const keyboard = stored.map((candidate, index) => [
        Markup.button.callback(candidateLabel(candidate), `lyrics:${lookupId}:${index}`)
      ]);
      await ctx.reply(
        `I found several matches for “${metadata.title}” by ${metadata.artist}. Which one do you want?`,
        Markup.inlineKeyboard(keyboard)
      );
    } catch (error) {
      logger.error('Audio lookup failed', {
        lookupId,
        userId: ctx.from?.id,
        error: error instanceof Error ? error.message : String(error)
      });
      try {
        await database.setLookupStatus(lookupId, 'failed');
      } catch {}
      await ctx.reply('Something went wrong while looking up the lyrics. Please try again later.');
    }
  }

  bot.action(CHOICE_PATTERN, async (ctx) => {
    const [, lookupId, positionText] = ctx.match;
    try {
      const result = await database.selectCandidate(lookupId, Number(positionText), ctx.from.id);
      if (result.kind === 'missing') {
        await ctx.answerCbQuery('This choice does not belong to you or no longer exists.', { show_alert: true });
        return;
      }
      if (result.kind === 'expired') {
        await ctx.answerCbQuery('These choices have expired. Send the song again.', { show_alert: true });
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});
        return;
      }
      if (result.kind === 'unavailable') {
        await ctx.answerCbQuery('A choice was already made for this song.', { show_alert: true });
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});
        return;
      }
      await ctx.answerCbQuery('Loading lyrics…');
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
      await sendLyrics(ctx, result.candidate);
    } catch (error) {
      logger.error('Candidate selection failed', {
        lookupId,
        userId: ctx.from?.id,
        error: error instanceof Error ? error.message : String(error)
      });
      await ctx.answerCbQuery('Could not load that choice. Please try again.', { show_alert: true });
    }
  });

  bot.catch((error, ctx) => {
    logger.error('Unhandled Telegram update error', {
      updateId: ctx.update.update_id,
      error: error instanceof Error ? error.message : String(error)
    });
  });

  return bot;
}
