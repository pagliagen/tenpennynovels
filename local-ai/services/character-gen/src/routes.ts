import { Router, Request, Response } from 'express';
import { CharacterGenerator } from './CharacterGenerator';
import { createLogger } from '../../../shared/logger';

const logger = createLogger('CharacterGen');
const router = Router();
const generator = new CharacterGenerator();

router.post('/generate', async (req: Request, res: Response) => {
  const { requestId, character, gameConfig } = req.body;

  if (!requestId || !character?.firstName || !character?.lastName || !character?.description) {
    res.status(400).json({ success: false, error: 'requestId, character.firstName, character.lastName and character.description are required' });
    return;
  }

  logger.info(`Generating character ${requestId}: ${character.firstName} ${character.lastName}`);
  const startMs = Date.now();

  try {
    const result = await generator.generate({ requestId, character, gameConfig });
    const processingMs = Date.now() - startMs;
    logger.info(`Character ${requestId} generated in ${processingMs}ms`);
    res.json({ success: true, ...result, processingMs });
  } catch (err: any) {
    logger.error(`Generation failed for ${requestId}: ${err.message}`);
    res.status(500).json({ success: false, error: err.message, status: 'failed' });
  }
});

export default router;
