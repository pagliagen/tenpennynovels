import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /generate
 *
 * TODO:
 * 1. Integrare Stable Diffusion locale (stesso backend di item-image-gen o istanza separata)
 * 2. Prompt template: "1920s [mood] [timeOfDay] scene of [name], [description], cinematic composition, [style]"
 * 3. Supportare mood: dark, mysterious, cozy, dangerous, elegant, decayed
 * 4. Supportare timeOfDay: day, night, dawn, dusk
 * 5. Stili: atmospheric painting, detailed illustration, noir photography, watercolor
 * 6. Formato landscape (16:9) di default per banner/header location
 * 7. Opzionale: generare varianti giorno/notte con singolo comando
 * 8. Bull queue per gestire le code (immagini piu grandi, generazione piu lenta)
 */
router.post('/generate', (req: Request, res: Response) => {
  const { externalLocationId, name, description, district, mood, timeOfDay, style } = req.body;

  res.status(501).json({
    success: false,
    error: 'Not implemented',
    service: 'location-image-gen',
    receivedPayload: { externalLocationId, name, description, district, mood, timeOfDay, style },
    todo: [
      'Integrare Stable Diffusion locale',
      'Prompt template per ambienti anni 20 con mood e ora del giorno',
      'Mood: dark, mysterious, cozy, dangerous, elegant, decayed',
      'timeOfDay: day, night, dawn, dusk',
      'Formato landscape 16:9 di default',
      'Varianti giorno/notte con singolo comando',
      'Bull queue con concurrency 1',
    ],
  });
});

router.get('/styles', (_req: Request, res: Response) => {
  res.json({
    success: true,
    styles: [
      { id: 'atmospheric', name: 'Atmospheric Painting', description: 'Dipinto atmosferico' },
      { id: 'illustration', name: 'Detailed Illustration', description: 'Illustrazione dettagliata' },
      { id: 'noir', name: 'Noir Photography', description: 'Fotografia noir in bianco e nero' },
      { id: 'watercolor', name: 'Watercolor', description: 'Acquerello' },
    ],
  });
});

router.get('/moods', (_req: Request, res: Response) => {
  res.json({
    success: true,
    moods: ['dark', 'mysterious', 'cozy', 'dangerous', 'elegant', 'decayed'],
  });
});

export default router;
