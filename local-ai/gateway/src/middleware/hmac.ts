import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

/**
 * Verifies HMAC-SHA256 signature using the authenticated client's hmacSecret.
 * Skipped if the client has no hmacSecret configured.
 */
export function verifyHMAC(req: Request, res: Response, next: NextFunction): void {
  const client = req.client;
  if (!client) {
    res.status(401).json({ success: false, error: 'Client not authenticated' });
    return;
  }

  // If client has no HMAC secret, skip verification
  if (!client.hmacSecret) {
    next();
    return;
  }

  const signature = req.headers['x-hmac-signature'] as string;
  const timestamp = req.headers['x-hmac-timestamp'] as string;

  if (!signature || !timestamp) {
    res.status(401).json({ success: false, error: 'Missing HMAC signature or timestamp' });
    return;
  }

  const timestampMs = parseInt(timestamp, 10);
  if (isNaN(timestampMs) || Math.abs(Date.now() - timestampMs) > MAX_TIMESTAMP_DRIFT_MS) {
    res.status(401).json({ success: false, error: 'Request timestamp expired or invalid' });
    return;
  }

  const body = JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', client.hmacSecret)
    .update(timestamp + '.' + body)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    res.status(401).json({ success: false, error: 'Invalid HMAC signature' });
    return;
  }

  next();
}
