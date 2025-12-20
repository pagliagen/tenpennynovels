# Embeddings Service

Servizio Python per la generazione di embeddings vettoriali utilizzando Sentence Transformers.

## Installazione Rapida

```bash
# Installa le dipendenze Python
pip3 install -r requirements.txt

# Test installazione
python3 embeddings_generator.py < test_input.json

# Pre-download del modello (opzionale, ~118MB)
python3 download_model.py
```

## Modello Utilizzato

- **Nome**: `paraphrase-multilingual-MiniLM-L12-v2`
- **Dimensioni**: 384
- **Lingue**: Multilingue (include italiano e inglese)
- **Dimensione**: ~118MB
- **Performance**: ~50-200ms per embedding su CPU standard

## Utilizzo da Node.js

Il servizio viene chiamato automaticamente dal TypeScript via `child_process`:

```typescript
import { getEmbeddingsService } from 'packages/shared/src/utils/embeddings';

const service = getEmbeddingsService();
const embedding = await service.generateEmbedding("Testo da convertire");
// embedding è un array di 384 numeri
```

## Input/Output Format

### Input (JSON via stdin)

```json
{
  "action": "generate",
  "text": "Il tuo testo qui"
}
```

### Output (JSON via stdout)

```json
{
  "success": true,
  "embedding": [0.123, -0.456, ...],
  "dimensions": 384
}
```

## Actions Disponibili

1. **generate**: Genera embedding per un singolo testo
2. **batch**: Genera embeddings per multipli testi
3. **similarity**: Calcola similarità coseno tra due embeddings

## Troubleshooting

### ModuleNotFoundError
```bash
pip3 install sentence-transformers torch
```

### Torch CUDA Warning
Normale su sistemi senza GPU. Il modello userà CPU (funzionale ma più lento).

### Download Lento
Il modello viene scaricato automaticamente al primo utilizzo da Hugging Face.
Cache location: `~/.cache/huggingface/`

## Performance

- Single embedding: ~50-200ms (CPU)
- Batch 10 texts: ~300-500ms (CPU)
- Con GPU: 10-20x più veloce

## Documentazione Completa

Vedi: `/docs/setup/embeddings-setup.md`
