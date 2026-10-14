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
    "send me a song and i'll find the lyrics. if a few versions show up, you can pick the right one."
  ));

  bot.help((ctx) => ctx.reply(
    'just send the song as an audio file. make sure telegram shows the title and artist above the player.'
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
        "can't read the title or artist on this one. fix the audio tags and send it again."
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
        await ctx.reply(`couldn't find lyrics for “${metadata.title}” by ${metadata.artist}.`);
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
        `found a few versions of “${metadata.title}”. which one is it?`,
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
      await ctx.reply('something went wrong on my side. try again in a bit.');
    }
  }

  bot.action(CHOICE_PATTERN, async (ctx) => {
    const [, lookupId, positionText] = ctx.match;
    try {
      const result = await database.selectCandidate(lookupId, Number(positionText), ctx.from.id);
      if (result.kind === 'missing') {
        await ctx.answerCbQuery("this one's not yours, or it's gone.", { show_alert: true });
        return;
      }
      if (result.kind === 'expired') {
        await ctx.answerCbQuery('these choices expired. send the song again.', { show_alert: true });
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});
        return;
      }
      if (result.kind === 'unavailable') {
        await ctx.answerCbQuery('you already picked one for this song.', { show_alert: true });
        await ctx.editMessageReplyMarkup(undefined).catch(() => {});
        return;
      }
      await ctx.answerCbQuery('got it');
      await ctx.editMessageReplyMarkup(undefined).catch(() => {});
      await sendLyrics(ctx, result.candidate);
    } catch (error) {
      logger.error('Candidate selection failed', {
        lookupId,
        userId: ctx.from?.id,
        error: error instanceof Error ? error.message : String(error)
      });
      await ctx.answerCbQuery("couldn't load that one. try again.", { show_alert: true });
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
