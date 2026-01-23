# Semantic Search per Documenti

Sistema di ricerca semantica AI-powered per i documenti di ambientazione e regolamento di TenpennyNovels.

## Overview

Il sistema permette agli utenti di fare domande in linguaggio naturale e trovare i documenti più rilevanti, senza dover conoscere keywords specifiche.

### Esempi di Utilizzo

**Domanda**: "Come posso creare un personaggio?"
**Risultato**: Documenti su creazione personaggi, character sheet, occupazioni

**Domanda**: "Quali sono le regole del combattimento?"
**Risultato**: Documenti su combattimento, armi vittoriane, iniziativa

**Domanda**: "Informazioni sulla Londra vittoriana"
**Risultato**: Documenti di ambientazione sui quartieri, società, economia

## Architettura

```
User Query
    ↓
TypeScript API (game-backend)
    ↓
Embeddings Service (Python)
    ↓
Sentence Transformers Model (384-dim vectors)
    ↓
Cosine Similarity Search
    ↓
MongoDB Documents Collection
    ↓
Ranked Results (by similarity)
```

## Componenti

### 1. Embeddings Service (Python)
- **Location**: `/services/embeddings-service/`
- **Model**: `paraphrase-multilingual-MiniLM-L12-v2`
- **Dimensioni**: 384
- **Lingue**: Italiano + Inglese
- **Size**: ~118MB

### 2. TypeScript Wrapper
- **Location**: `/services/shared/src/utils/embeddings.ts`
- **Interface**: Chiamate al servizio Python via spawn
- **Caching**: Nessuno (stateless)

### 3. API Endpoint
- **Route**: `GET /documents/semantic-search`
- **Controller**: `DocumentController.semanticSearchDocuments`
- **Auth**: Optional (filtra risultati in base a visibilità)

### 4. CLI Tool
- **Script**: `/scripts/document-chat.ts`
- **Modalità**: Interattiva + Single query
- **Comando**: `npm run document:chat`

### 5. Database
- **Collection**: `documents`
- **Nuovo Campo**: `contentEmbedding: number[]` (384 dimensioni)
- **Index**: Nessun indice speciale necessario (calcolo in-memory)

## Setup Completo

### Step 1: Installare Sentence Transformers

```bash
# Installa Python dependencies
pip3 install sentence-transformers torch

# Verifica installazione
npm run embeddings:test

# Output atteso:
# {
#   "success": true,
#   "embedding": [...],
#   "dimensions": 384
# }
```

**Per server di produzione**, vedi [embeddings-setup.md](../setup/embeddings-setup.md).

### Step 2: Generare Embeddings

```bash
# Reset database e genera embeddings
npm run db:reset

# Output atteso per ogni documento:
# 📊 Generating embedding for: Titolo Documento
# ✅ Embedding generated (384 dimensions)
```

Se embeddings service non è disponibile, il seed continuerà senza generare embeddings (degrada gracefully).

### Step 3: Test Semantic Search

#### Via CLI (Interattivo)

```bash
npm run document:chat

# Interface interattiva:
💬 Domanda (o "exit" per uscire): Come creo un personaggio?

📄 Trovati 3 documenti rilevanti:

1. 🌍 Guida Rapida per Nuovi Giocatori
   Match: 95.2% | Tipo: regolamento | Gruppo: Sistema di Gioco
   Come iniziare a giocare su TenpennyNovels.
   "Benvenuto su TenpennyNovels! Questa guida ti aiuterà..."

2. 📜 Creazione Personaggio
   Match: 87.4% | Tipo: regolamento | Gruppo: Sistema di Gioco
   Guida completa alla creazione di personaggi per TenpennyNovels.
   "La creazione di un personaggio per TenpennyNovels segue..."
```

#### Via CLI (Single Query)

```bash
npm run document:search "Come funziona il combattimento?"
```

#### Via API

```bash
curl "http://localhost:8000/game/documents/semantic-search?q=Come%20funziona%20il%20combattimento?&limit=3"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "...",
        "title": "FAQ Sistema di Combattimento",
        "matchScore": "92.5%",
        "similarity": 0.925,
        "contentPreview": "..."
      }
    ],
    "totalResults": 5,
    "returnedResults": 3
  }
}
```

## Uso dall'Applicazione Frontend

### Esempio in React/Next.js

```typescript
// In un componente di ricerca
const [query, setQuery] = useState('');
const [results, setResults] = useState([]);
const [loading, setLoading] = useState(false);

const handleSearch = async () => {
  setLoading(true);
  try {
    const response = await fetch(
      `/api/documents/semantic-search?q=${encodeURIComponent(query)}&limit=5`
    );
    const data = await response.json();
    setResults(data.data.results);
  } catch (error) {
    console.error('Search error:', error);
  } finally {
    setLoading(false);
  }
};

// JSX
<input
  type="text"
  placeholder="Fai una domanda..."
  value={query}
  onChange={(e) => setQuery(e.target.value)}
/>
<button onClick={handleSearch} disabled={loading}>
  {loading ? 'Ricerca in corso...' : 'Cerca'}
</button>

{results.map(result => (
  <div key={result.id}>
    <h3>{result.title}</h3>
    <p>Match: {result.matchScore}</p>
    <p>{result.contentPreview}</p>
    <Link href={`/documents/${result.type}/${result.slug}`}>
      Leggi documento
    </Link>
  </div>
))}
```

## Performance

### Tempi di Risposta (CPU standard)

- **Generazione embedding query**: 50-200ms
- **Calcolo similarità (20 documenti)**: 5-10ms
- **Totale**: ~100-250ms

### Ottimizzazioni Future

1. **Caching embeddings query comuni**: Redis cache per query frequenti
2. **Vector Database**: Pinecone/Weaviate per dataset grandi (100k+ docs)
3. **GPU Acceleration**: 10-20x più veloce per batch generation

## Maintenance

### Rigenerare Embeddings

```bash
# Rigenera embeddings per tutti i documenti
npm run seed:documents

# Con force reset
npm run seed:force
```

### Aggiornare Modello

```bash
# Cambia modello in .env
EMBEDDINGS_MODEL=sentence-transformers/distiluse-base-multilingual-cased-v2

# Rigenera embeddings
npm run seed:documents
```

### Monitoraggio

```bash
# Check quanti documenti hanno embeddings
mongo tenpennynovels --eval "db.documents.countDocuments({contentEmbedding: {$exists: true}})"

# Check dimensioni embeddings
mongo tenpennynovels --eval "db.documents.findOne({contentEmbedding: {$exists: true}}, {contentEmbedding: 1})"
```

## Troubleshooting

### "Embeddings service unavailable"

```bash
# Test servizio
npm run embeddings:test

# Se fallisce, verifica installazione
pip3 show sentence-transformers

# Reinstalla se necessario
pip3 install --upgrade sentence-transformers torch
```

### "No documents with embeddings found"

```bash
# Genera embeddings
npm run seed:documents

# Verifica database
mongo tenpennynovels --eval "db.documents.find({contentEmbedding: {$exists: true}}).count()"
```

### Performance Degradation

```bash
# Riduci batch size
export EMBEDDINGS_BATCH_SIZE=16

# Monitor RAM usage
top -pid $(pgrep -f embeddings_generator)
```

## Limitazioni

- **Max Query Length**: ~512 tokens (2000 chars)
- **Languages**: Ottimizzato per italiano/inglese
- **Similarity Threshold**: Default 0.5 (50% similarity)
- **Result Limit**: Max 20 documenti per query

## Roadmap

- [ ] WebSocket real-time search suggestions
- [ ] User feedback per migliorare risultati
- [ ] Multi-language support (francese, spagnolo)
- [ ] Hybrid search (keyword + semantic)
- [ ] Search analytics dashboard

## Riferimenti

- **Sentence Transformers**: https://www.sbert.net/
- **Modello Usato**: https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
- **Setup Guide**: [embeddings-setup.md](../setup/embeddings-setup.md)
- **API Docs**: [api-docs.md](../api-docs.md#documents)

---

**Ultima revisione**: 2025-10-21
**Versione**: 1.0.0
**Autore**: TenpennyNovels Development Team
