import { Router, Request, Response } from 'express';
import { askWithContext } from './services/RAGPipeline';
import { extractKeywords } from './services/AnswerEvaluator';
import { extractInsight } from './services/DocumentInsightExtractor';
import { createLogger } from '../../../shared/logger';

const logger = createLogger('QA');
const router = Router();

router.post('/ask', async (req: Request, res: Response) => {
  try {
    const { question, context, options } = req.body;

    const result = await askWithContext(
      question,
      context,
      options?.locale || 'it',
      options?.maxTokens || 800
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error(`Error in /ask: ${error.message}`);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/extract-keywords', async (req: Request, res: Response) => {
  try {
    const { question, answer } = req.body;

    const result = await extractKeywords({ question, answer });

    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error(`Error in /extract-keywords: ${error.message}`);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.post('/extract-insight', async (req: Request, res: Response) => {
  try {
    const { question, existingAnswer, documentContent, documentTitle } = req.body;

    const result = await extractInsight({
      question,
      existingAnswer,
      documentContent,
      documentTitle,
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    logger.error(`Error in /extract-insight: ${error.message}`);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
