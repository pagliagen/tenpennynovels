---
name: Score ibrido unico per semantic search
overview: Sostituire lo score RRF (basato sul rank) con la cosine similarity reale da Qdrant come punteggio unico, mantenendo ElasticSearch per la scoperta dei candidati ma non per lo scoring.
todos:
  - id: pass-cosine-score
    content: "Modificare vectorSearch in EmbeddingsHttpServer per propagare r.score (cosine similarity) nel risultato"
    status: pending
  - id: replace-merge
    content: "Sostituire mergeWithRRF con mergeWithCosineScore: unifica candidati da ES+Qdrant ma usa cosine come score; keyword-only capped a 0.35"
    status: pending
  - id: update-controller
    content: "Aggiornare DocumentController: rimuovere normalizzazione RRF, usare score*100, aggiungere soglia minima 50%"
    status: pending
  - id: test-and-verify
    content: "Test con le stesse 20 query per verificare che i risultati siano coerenti con le aspettative"
    status: pending
isProject: false
---

# Score basato su Cosine Similarity per Semantic Search

## Risultati empirici (20 query di test)

I test hanno dimostrato che:

- **Cosine similarity** (Qdrant) e il segnale piu affidabile in tutti i 20 test
- **BM25** (ElasticSearch) produce falsi positivi frequenti (match su parole comuni come "vittoriani", "come si")
- **RRF** comprime gli score artificialmente (97% per risultati irrilevanti)
- Gap naturali della cosine similarity sono molto discriminanti (0.73 vs 0.41 per "vampiro")

Range empirici osservati:
- 0.70-0.85+: match quasi perfetto
- 0.55-0.70: molto rilevante
- 0.45-0.55: marginalmente rilevante
- sotto 0.40: irrilevante

## Strategia

- **Score mostrato** = cosine similarity * 100 (unico punteggio, veritiero)
- **ElasticSearch** continua a funzionare per la **scoperta** (trovare candidati keyword), ma NON contribuisce allo score
- **Risultati keyword-only** (trovati da ES ma non da Qdrant) vengono cappati a score 0.35 (sotto la soglia display)
- **Soglia display**: >= 50% (cosine >= 0.50)
- **Soglia AI**: >= 55% (cosine >= 0.55, da calibrare)

## Modifiche

### 1. Embeddings Worker - Propagare cosine e calcolare score

**File**: [services/embeddings-worker/src/http/EmbeddingsHttpServer.ts](services/embeddings-worker/src/http/EmbeddingsHttpServer.ts)

**a) `vectorSearch()` (riga 197)**: aggiungere `semanticScore: r.score`

```typescript
return results.map((r, i) => ({
  chunkId: r.payload?.chunkId as string,
  documentId: r.payload?.documentId as string,
  slug: r.payload?.slug as string,
  heading: r.payload?.heading as string,
  type: r.payload?.documentType as string,
  parentSlug: r.payload?.parentSlug as string | undefined,
  semanticScore: r.score,   // cosine similarity 0-1
  rank: i + 1
}));
```

**b) Sostituire `mergeWithRRF()` con `mergeWithCosineScore()`**: unifica i candidati da entrambe le fonti, ma usa la cosine similarity come unico score.

```typescript
private mergeWithCosineScore(keywordResults: any[], semanticResults: any[], limit: number) {
  const KEYWORD_ONLY_CAP = 0.35;
  const scoreMap = new Map<string, { data: any; score: number }>();

  // Risultati keyword: score provvisorio cappato (verra sovrascritto se presente anche in Qdrant)
  for (const r of keywordResults) {
    scoreMap.set(r.chunkId, { data: r, score: KEYWORD_ONLY_CAP });
  }

  // Risultati semantic: cosine similarity reale (sovrascrive il cap keyword se presente)
  for (const r of semanticResults) {
    const existing = scoreMap.get(r.chunkId);
    if (existing) {
      existing.score = r.semanticScore;
    } else {
      scoreMap.set(r.chunkId, { data: r, score: r.semanticScore });
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => ({
      chunkId: item.data.chunkId,
      documentId: item.data.documentId,
      slug: item.data.slug,
      heading: item.data.heading,
      score: item.score,
      type: item.data.type,
      parentSlug: item.data.parentSlug,
    }));
}
```

**c) Aggiornare la chiamata** nel handler `/search`: `this.mergeWithRRF(...)` diventa `this.mergeWithCosineScore(...)`.

### 2. DocumentController - Usare score diretto + soglia

**File**: [services/unified-backend/src/modules/documents/controllers/DocumentController.ts](services/unified-backend/src/modules/documents/controllers/DocumentController.ts)

**a) Sostituire normalizzazione RRF** (righe 370-382):

```typescript
// PRIMA (RRF):
const RRF_K = 60;
const maxRrfScore = 2 / (RRF_K + 1);
const normalizedScore = Math.min((result.score / maxRrfScore) * 100, 100);

// DOPO (cosine similarity, gia 0-1):
const normalizedScore = Math.min(Math.round(result.score * 100), 100);
```

**b) Aggiungere soglia minima display**:

```typescript
const MIN_DISPLAY_SCORE = 50;
const displayResults = (results as any[])
  .filter(r => parseInt(r.matchScore) >= MIN_DISPLAY_SCORE)
  .slice(0, displayLimit);
```

**c) Aggiornare soglia AI**: `MIN_AI_SCORE` da 35 a 55 (calibrare con test).

### 3. Frontend - Nessuna modifica

Il frontend mostra gia `matchScore` come stringa percentuale. Ricevera semplicemente punteggi piu realistici e meno risultati irrilevanti.

## File da modificare

1. [services/embeddings-worker/src/http/EmbeddingsHttpServer.ts](services/embeddings-worker/src/http/EmbeddingsHttpServer.ts) - vectorSearch + mergeWithCosineScore
2. [services/unified-backend/src/modules/documents/controllers/DocumentController.ts](services/unified-backend/src/modules/documents/controllers/DocumentController.ts) - normalizzazione + soglie
