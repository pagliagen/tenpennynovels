import { Response } from 'express';
import { CharacterGenInput, GenEvent, GenStatus, CharacterGenResult } from './types';
import { CharacterGenerator, isAbortError, makeAbortError } from './CharacterGenerator';
import { createLogger } from '../../../shared/logger';

const logger = createLogger('GenerationManager');

const SESSION_TTL_MS = 60 * 60 * 1000; // 1h
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5min
const SSE_PING_INTERVAL_MS = 15 * 1000; // keep-alive

interface SessionState {
  sessionKey: string;
  currentGenerationId: number;
  input: CharacterGenInput;
  gameConfig: any;
  status: GenStatus;
  events: GenEvent[];
  result?: CharacterGenResult;
  error?: string;
  abortController: AbortController;
  subscribers: Set<Response>;
  currentStep: number;
  partialCharacter: any;
  resumeFromStep?: number;
  approvalPending?: boolean;
  approvalPromise?: Promise<void>;
  approvalResolve?: () => void;
  createdAt: number;
  updatedAt: number;
}

export class GenerationManager {
  private sessions = new Map<string, SessionState>();
  private queue: string[] = [];
  private running: string | null = null;
  private generator = new CharacterGenerator();

  constructor() {
    setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS).unref();
  }

  submit(input: CharacterGenInput, gameConfig: any): { generationId: number } {
    return this.submitWithResume(input, gameConfig, undefined, undefined);
  }

  submitWithResume(input: CharacterGenInput, gameConfig: any, resumeFromStep?: number, previousData?: any): { generationId: number } {
    const key = input.sessionKey;
    const existing = this.sessions.get(key);

    if (existing) {
      // Cancel-and-replace
      this.abortSession(existing, 'replaced');
      this.queue = this.queue.filter(k => k !== key);

      const newGenId = existing.currentGenerationId + 1;
      existing.currentGenerationId = newGenId;
      existing.input = input;
      existing.gameConfig = gameConfig;
      existing.status = 'queued';
      existing.events = [];
      existing.result = undefined;
      existing.error = undefined;
      existing.partialCharacter = previousData || {};
      existing.resumeFromStep = resumeFromStep;
      existing.abortController = new AbortController();
      existing.updatedAt = Date.now();

      this.emit(existing, { generationId: newGenId, type: 'restarted', data: { generationId: newGenId, resumeFromStep } });
      this.enqueue(key);
      return { generationId: newGenId };
    }

    const state: SessionState = {
      sessionKey: key,
      currentGenerationId: 1,
      input,
      gameConfig,
      status: 'queued',
      events: [],
      abortController: new AbortController(),
      subscribers: new Set(),
      currentStep: 0,
      partialCharacter: previousData || {},
      resumeFromStep,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.set(key, state);
    this.enqueue(key);
    return { generationId: 1 };
  }

  subscribe(sessionKey: string, res: Response): boolean {
    const state = this.sessions.get(sessionKey);
    if (!state) return false;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    this.writeEvent(res, {
      generationId: state.currentGenerationId,
      type: 'state',
      data: { status: state.status, currentGenerationId: state.currentGenerationId, stepsBuffered: state.events.length },
    });

    for (const ev of state.events) {
      this.writeEvent(res, ev);
    }

    state.subscribers.add(res);

    const ping = setInterval(() => {
      try {
        // Stop pinging if generation is complete/error/aborted
        if (state.status === 'complete' || state.status === 'error' || state.status === 'aborted') {
          clearInterval(ping);
          res.end();  // Close connection
          return;
        }

        // Send status update instead of empty ping
        const isProcessing = state.status === 'processing';
        this.writeEvent(res, {
          generationId: state.currentGenerationId,
          type: 'status',
          data: { status: isProcessing ? 'inprogress' : state.status, step: state.currentStep }
        });
      } catch { /* noop */ }
    }, SSE_PING_INTERVAL_MS);

    res.on('close', () => {
      clearInterval(ping);
      state.subscribers.delete(res);
    });

    return true;
  }

  getPartialCharacter(sessionKey: string): any | null {
    const state = this.sessions.get(sessionKey);
    return state ? state.partialCharacter : null;
  }

  approveNarrative(sessionKey: string): boolean {
    const state = this.sessions.get(sessionKey);
    if (!state || !state.approvalPending) return false;

    state.approvalPending = false;
    logger.info(`Narrative approved: session=${sessionKey}`);

    if (state.approvalResolve) {
      state.approvalResolve();
      state.approvalResolve = undefined;
    }
    return true;
  }

  rejectNarrative(sessionKey: string): boolean {
    const state = this.sessions.get(sessionKey);
    if (!state || !state.approvalPending) return false;

    state.approvalPending = false;
    logger.info(`Narrative rejected: session=${sessionKey}`);
    return true;
  }

  private createApprovalPromise(): { promise: Promise<void>; resolve: () => void } {
    let resolve: () => void;
    const promise = new Promise<void>((res) => {
      resolve = res;
    });
    return { promise, resolve: resolve! };
  }

  private enqueue(key: string) {
    if (!this.queue.includes(key) && this.running !== key) {
      this.queue.push(key);
      logger.debug(`Enqueued: ${key} (queue size: ${this.queue.length})`);
    }
    this.processNext();
  }

  private processNext() {
    if (this.running) {
      logger.debug(`processNext: already running ${this.running}`);
      return;
    }
    const key = this.queue.shift();
    if (!key) {
      logger.debug(`processNext: queue empty`);
      return;
    }
    logger.info(`processNext: starting session ${key}`);

    const state = this.sessions.get(key);
    if (!state) { this.processNext(); return; }
    if (state.status === 'aborted') { this.processNext(); return; }

    this.running = key;
    state.status = 'processing';
    state.approvalPending = false;
    state.updatedAt = Date.now();
    const genId = state.currentGenerationId;
    const signal = state.abortController.signal;

    const { promise: approvalPromise, resolve: approvalResolve } = this.createApprovalPromise();
    state.approvalPromise = approvalPromise;
    state.approvalResolve = approvalResolve;

    logger.info(`Starting generator for session ${key} gen ${genId}`);
    this.generator
      .run(
        state.input,
        state.gameConfig,
        signal,
        (type, data) => {
          const stepLabel = data.step ? `step=${data.step}` : '';
          logger.debug(`Emit event: ${type} ${stepLabel} (gen=${genId})`);
          this.emit(state, { generationId: genId, type: type as any, data });

          if (type === 'step' && data.step === 1 && data.status === 'complete' && state.resumeFromStep === undefined) {
            state.approvalPending = true;
            logger.info(`Step 1 complete, waiting for approval: session=${key}`);
            this.emit(state, { generationId: genId, type: 'approval_needed', data: { narrativeText: state.partialCharacter.narrativeText } });
          }
        },
        state.resumeFromStep,
        state.partialCharacter,
        state.resumeFromStep === undefined ? approvalPromise : undefined
      )
      .then((result) => {
        logger.info(`Generator completed for session ${key} gen ${genId}`);
        if (state.currentGenerationId !== genId) return;
        state.status = 'complete';
        state.result = result;
        state.updatedAt = Date.now();
        this.emit(state, { generationId: genId, type: 'complete', data: { ...result } });
      })
      .catch((err) => {
        if (isAbortError(err)) {
          logger.info(`Generation aborted: session=${key} gen=${genId}`);
          return;
        }
        if (state.currentGenerationId !== genId) return;
        state.status = 'error';
        state.error = err.message;
        state.updatedAt = Date.now();
        logger.error(`Generation failed: session=${key} gen=${genId}`, { error: err.message });
        this.emit(state, { generationId: genId, type: 'error', data: { error: err.message, code: 'GENERATION_ERROR', status: 'error' } });
      })
      .finally(() => {
        if (!state.approvalPending) {
          this.running = null;
          this.processNext();
        } else {
          this.running = null;
        }
      });
  }

  private abortSession(state: SessionState, reason: string) {
    if (state.status === 'processing' || state.status === 'queued') {
      const genId = state.currentGenerationId;
      state.abortController.abort();
      state.status = 'aborted';
      state.updatedAt = Date.now();
      this.emit(state, { generationId: genId, type: 'aborted', data: { reason } });
    }
  }

  private emit(state: SessionState, ev: GenEvent) {
    // Track current step for status pings
    if (ev.type === 'step' && typeof ev.data.step === 'number') {
      state.currentStep = ev.data.step;
    }

    // When step completes, accumulate character data and include in SSE
    if (ev.type === 'step' && ev.data.status === 'complete' && ev.data.partialCharacter) {
      state.partialCharacter = { ...state.partialCharacter, ...ev.data.partialCharacter };
      // Include accumulated character data in the event
      ev.data.character = state.partialCharacter;
      delete ev.data.partialCharacter; // Remove intermediate field
    }

    state.events.push(ev);
    for (const res of state.subscribers) {
      this.writeEvent(res, ev);
    }
  }

  private writeEvent(res: Response, ev: GenEvent) {
    try {
      res.write(`event: ${ev.type}\n`);
      res.write(`data: ${JSON.stringify({ generationId: ev.generationId, ...ev.data })}\n\n`);
    } catch { /* client disconnected */ }
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, state] of this.sessions) {
      const terminal = state.status === 'complete' || state.status === 'error' || state.status === 'aborted';
      if (terminal && state.subscribers.size === 0 && now - state.updatedAt > SESSION_TTL_MS) {
        this.sessions.delete(key);
        logger.debug(`Cleaned up session: ${key}`);
      }
    }
  }
}

export const generationManager = new GenerationManager();
