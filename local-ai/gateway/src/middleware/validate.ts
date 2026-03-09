import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const callbackSchema = z.object({
  url: z.string().url(),
  method: z.enum(['POST', 'PUT', 'PATCH']),
  headers: z.record(z.string()),
});

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
    actions: z.array(z.object({
      characterId: z.string().optional(),
      characterName: z.string().min(1),
      content: z.string().min(1),
      timestamp: z.string().optional(),
    })).min(1),
    presentCharacters: z.array(z.object({
      id: z.string().optional(),
      name: z.string(),
    })).optional(),
  }),
  callback: callbackSchema,
});

export const qaAskSchema = z.object({
  question: z.string().min(1).max(2000),
  context: z.array(z.object({
    heading: z.string(),
    content: z.string(),
    source: z.object({
      documentId: z.string().optional(),
      slug: z.string().optional(),
      fullPath: z.string().optional(),
      title: z.string().optional(),
      subtypeTitle: z.string().optional(),
    }).optional(),
  })).min(1),
  options: z.object({
    maxTokens: z.number().int().min(50).max(2000).optional(),
    locale: z.string().optional(),
  }).optional(),
});

export const qaExtractKeywordsSchema = z.object({
  question: z.string().min(1).max(2000),
  answer: z.string().min(1).max(5000),
});

export const qaExtractInsightSchema = z.object({
  question: z.string().min(1).max(2000),
  existingAnswer: z.string().min(1).max(5000),
  documentContent: z.string().min(1).max(5000),
  documentTitle: z.string().min(1).max(500),
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
  callback: callbackSchema,
});

export const imageGenSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  style: z.string().optional(),
  options: z.object({
    width: z.number().int().min(64).max(2048).optional(),
    height: z.number().int().min(64).max(2048).optional(),
    format: z.enum(['png', 'jpeg', 'webp']).optional(),
  }).optional(),
  callback: callbackSchema,
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
