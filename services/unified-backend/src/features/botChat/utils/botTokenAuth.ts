import { Request, Response, NextFunction } from 'express';
import { appConfig } from '@config/runtime';
import { botChatConfigStatus } from './botChatConfig';
import { verifyBotToken, type BotTokenPayload } from './botToken';

/** Autenticazione dell'API di ritorno (`/bot-api`): token per evento, vedi `botToken.ts`. Modulo a sé, senza il controller, per poterlo testare. */

export const TOKEN_LOCAL = 'botToken';

/** Senza la configurazione completa l'API non esiste (404), non è «aperta». */
export function botTokenAuth(req: Request, res: Response, next: NextFunction): void {
  const status = botChatConfigStatus();
  const secret = appConfig.services.botService.secret;
  if (!status.complete || !secret) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const payload = token ? verifyBotToken(token, secret) : null;
  // Un token di un altro ambiente (es. di produzione presentato al backend locale) non vale.
  if (!payload || payload.env !== appConfig.botEnvironment) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  res.locals[TOKEN_LOCAL] = payload;
  next();
}

/** Il token vale per UN bot in UNA location: la risposta deve essere di quel bot, lì. */
export function botTokenScope(req: Request, res: Response, next: NextFunction): void {
  const token = res.locals[TOKEN_LOCAL] as BotTokenPayload | undefined;
  const { characterId, locationId } = (req.body ?? {}) as { characterId?: unknown; locationId?: unknown };
  if (!token || characterId !== token.bot || locationId !== token.loc) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }
  next();
}
