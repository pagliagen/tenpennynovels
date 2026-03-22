# Documenti e ricerca

**Navigazione**: [Documentazione funzionale](./README.md) → Documenti e ricerca

---

## Cosa fa il sistema

La **knowledge base** raccoglie testi di ambientazione, regolamento e approfondimenti. L’app **documents** offre navigazione e **ricerca semantica** (significato del testo, non solo parole chiave), appoggiata a embedding, indice full-text e vector DB gestiti dal backend e dall’embeddings-worker.

## Per il giocatore (o lettore)

- Esplori i documenti pubblicati dal team con ricerca e filtri previsti dall’interfaccia.
- I risultati più rilevanti emergono anche quando non usi le stesse parole del testo originale.

## Dettagli tecnici

Vedi [Documents App](../tecnica/frontend/documents-app.md), [Embeddings Worker](../tecnica/backend/embeddings-worker.md), [Qdrant](../tecnica/infrastructure/qdrant-vector-db.md) e [Semantic search in deploy](../deploy/docs/08-semantic-search-setup.md) per l’ambiente di produzione.
