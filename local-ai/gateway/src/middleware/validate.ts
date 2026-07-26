import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const callbackSchema = z.object({
  url: z.string().url(),
  method: z.enum(['POST', 'PUT', 'PATCH']),
  headers: z.record(z.string()),
});

const actionSchema = z.object({
  id: z.string().optional(),
  characterId: z.string().optional(),
  characterName: z.string().min(1),
  content: z.string().min(1),
  type: z.string().optional(),
  timestamp: z.string().optional(),
});

/**
 * Accepts two equivalent payload shapes:
 *  A) context.actions[]           — used by test scripts and direct API calls
 *  B) context.triggeringAction + context.recentActions[]  — used by unified-backend
 * Both are normalised to context.actions[] before reaching botai.
 */
export const botRespondSchema = z.object({
  requestId: z.string().min(1),
  bot: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
  context: z.object({
    location: z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
    }),
    // Shape A
    actions: z.array(actionSchema).optional(),
    // Shape B (unified-backend)
    triggeringAction: actionSchema.optional(),
    recentActions: z.array(actionSchema).optional(),
    presentCharacters: z.array(z.object({
      id: z.string().optional(),
      name: z.string(),
      gender: z.string().optional(),
      apparentAge: z.number().optional(),
      physicalDescription: z.string().optional(),
      visibleMarks: z.string().optional(),
      height: z.string().optional(),
      eyeColor: z.string().optional(),
      hairColor: z.string().optional(),
    })).optional(),
  }).transform((ctx) => {
    // Normalise to actions[] regardless of input shape
    if (!ctx.actions || ctx.actions.length === 0) {
      const combined = [
        ...(ctx.recentActions ?? []),
        ...(ctx.triggeringAction ? [ctx.triggeringAction] : []),
      ];
      return { ...ctx, actions: combined };
    }
    return ctx;
  }).refine((ctx) => ctx.actions && ctx.actions.length > 0, {
    message: 'context must include at least one action (via actions[] or triggeringAction)',
  }),
  callback: callbackSchema.optional(),
});

export const botCreateSchema = z.object({
  name: z.string().min(1).max(200),
  gender: z.enum(['male', 'female']).optional(),
  publicDescription: z.string().optional(),
  personality: z.object({
    traits: z.array(z.string()),
    speech_style: z.string(),
    background: z.string(),
    coreValues: z.array(z.string()).optional(),
  }),
  systemPrompt: z.string().min(1),
  narrativeStyle: z.object({
    author: z.string().min(1).max(200),
    guidance: z.string().min(1),
  }).optional(),
});

export const botRefineSchema = z.object({
  hints: z.record(z.unknown()).optional(),
  style: z.string().optional(),
  locale: z.string().optional(),
});

export const botGenerateSchema = z.object({
  requestId: z.string().min(1),
  description: z.string().min(10).max(2000),
  location: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  }).optional(),
  style: z.string().optional(),
  locale: z.string().optional(),
});

export const seoGenerateDescriptionSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100000),
});

export const characterGenSchema = z.object({
  requestId: z.string().min(1),
  character: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    gender: z.enum(['male', 'female', 'other']),
    description: z.string().min(10).max(2000),
  }),
  gameConfig: z.object({
    skills: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      baseValue: z.number().int().min(0).max(100),
      category: z.string(),
      isPlaceholder: z.boolean().optional(),
    })).default([]),
    occupations: z.array(z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional(),
      bonusSkills: z.array(z.string()).optional(),
    })).default([]),
    statsBudget: z.number().int().min(300).max(600).default(450),
    skillsBudget: z.number().int().min(100).max(500).default(250),
  }).default({}),
});

type ZodSchema = z.ZodType<any, any, any>;

export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
