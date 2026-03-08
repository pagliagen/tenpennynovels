import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /generate
 *
 * TODO:
 * 1. Integrare Stable Diffusion con LoRA/checkpoint ottimizzato per ritratti (es. realistic portrait SDXL LoRA)
 * 2. Prompt template: "1920s portrait of [gender] in their [age], [physicalDescription], [style], head and shoulders, neutral background"
 * 3. Gestione genere e eta per prompt coerenti
 * 4. Opzione bust: true/false per mezzo busto vs viso pieno
 * 5. Stili: portrait painting, photorealistic, illustrated, noir sketch
 * 6. Seed persistente: salvare il seed usato per un personaggio per rigenerare immagini coerenti (stesso viso)
 * 7. Endpoint POST /regenerate con seed fissato per varianti (espressioni, abbigliamento diverso)
 * 8. Bull queue (ritratti richiedono piu steps)
 */
router.post('/generate', (req: Request, res: Response) => {
  const { externalCharacterId, name, physicalDescription, gender, age, style } = req.body;

  res.status(501).json({
    success: false,
    error: 'Not implemented',
    service: 'avatar-gen',
    receivedPayload: { externalCharacterId, name, physicalDescription, gender, age, style },
    todo: [
      'Integrare Stable Diffusion con LoRA per ritratti realistici',
      'Prompt template per ritratti anni 20',
      'Gestione genere e eta per prompt coerenti',
      'Opzione bust true/false',
      'Stili: portrait painting, photorealistic, illustrated, noir sketch',
      'Seed persistente per coerenza del viso',
      'Endpoint POST /regenerate con seed fissato',
      'Bull queue con concurrency 1',
    ],
  });
});

router.post('/regenerate', (req: Request, res: Response) => {
  res.status(501).json({
    success: false,
    error: 'Not implemented',
    service: 'avatar-gen',
    endpoint: '/regenerate',
    todo: ['Rigenerazione con seed fissato per varianti espressive'],
  });
});

router.get('/styles', (_req: Request, res: Response) => {
  res.json({
    success: true,
    styles: [
      { id: 'portrait', name: 'Portrait Painting', description: 'Ritratto a olio in stile classico' },
      { id: 'photorealistic', name: 'Photorealistic', description: 'Fotorealistico anni 20' },
      { id: 'illustrated', name: 'Illustrated', description: 'Illustrazione stilizzata' },
      { id: 'noir', name: 'Noir Sketch', description: 'Schizzo noir in bianco e nero' },
    ],
  });
});

export default router;
