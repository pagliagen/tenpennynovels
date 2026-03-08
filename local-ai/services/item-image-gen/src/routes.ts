import { Router, Request, Response } from 'express';

const router = Router();

/**
 * POST /generate
 *
 * TODO:
 * 1. Integrare Stable Diffusion locale (via ComfyUI API o diffusers Python) oppure Flux.1-dev
 * 2. Creare prompt template: nome + descrizione + categoria → prompt ottimizzato
 *    Es: "victorian era illustration of [name], [description], white background, item sheet style"
 * 3. Supportare stili predefiniti: realistic, illustrated, sketch, icon
 * 4. Cache locale per evitare rigenerazione con stessa descrizione
 * 5. Bull queue: una immagine alla volta per non saturare GPU/CPU
 */
router.post('/generate', (req: Request, res: Response) => {
  const { externalItemId, name, description, category, style } = req.body;

  res.status(501).json({
    success: false,
    error: 'Not implemented',
    service: 'item-image-gen',
    receivedPayload: { externalItemId, name, description, category, style },
    todo: [
      'Integrare Stable Diffusion locale (ComfyUI API o diffusers Python) oppure Flux.1-dev',
      'Prompt template: nome + descrizione + categoria → prompt SD ottimizzato',
      'Stili predefiniti: realistic, illustrated, sketch, icon',
      'Cache locale (hash descrizione → immagine)',
      'Bull queue con concurrency 1',
    ],
  });
});

router.get('/styles', (_req: Request, res: Response) => {
  res.json({
    success: true,
    styles: [
      { id: 'realistic', name: 'Realistic Victorian Illustration', description: 'Illustrazione realistica in stile vittoriano' },
      { id: 'illustrated', name: 'Illustrated', description: 'Illustrazione stilizzata' },
      { id: 'sketch', name: 'Pencil Sketch', description: 'Schizzo a matita' },
      { id: 'icon', name: 'Game Icon', description: 'Icona per inventario di gioco' },
    ],
  });
});

export default router;
