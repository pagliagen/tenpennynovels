# Bot AI Costs - Local AI (Ollama)

Analisi costi per il sistema Bot AI con **Ollama** (modelli locali).

**Ultima revisione**: 8 Marzo 2026
**Modello**: `mistral:7b-instruct` (via Ollama)

---

## Executive Summary

| Voce | Valore |
|------|--------|
| **Costo per interazione** | $0.00 |
| **Costo API mensile** | $0.00 |
| **Infrastruttura** | Solo hardware locale (già posseduto) |

Con la migrazione da Claude (API a pagamento) a Ollama (modelli locali), il costo operativo per le interazioni bot è **zero**.

---

## Confronto con il vecchio sistema

| Aspetto | v1 (Claude API) | v2 (Ollama locale) |
|---------|-----------------|-------------------|
| Costo per interazione | ~$0.007 | $0.00 |
| Costo mensile stimato (1000 interazioni) | ~$7.00 | $0.00 |
| Latenza | ~2-3s (rete + API) | ~1-5s (locale, dipende da hardware) |
| Dipendenza esterna | Si (API key, rate limits) | No |
| Privacy dati | Dati inviati a terzi | Tutto locale |

---

## Costi infrastrutturali

L'unico costo è l'hardware locale su cui gira Ollama:
- **CPU/GPU**: Il modello gira sulla macchina di sviluppo
- **Storage**: ~4GB per il modello `mistral:7b-instruct`
- **RAM**: ~6-8GB durante l'inferenza

Nessun abbonamento, nessuna API key, nessun limite di rate.

---

## Note

Il vecchio documento con l'analisi dettagliata dei costi Claude è disponibile in `_archive/botai-backend/` per riferimento storico.
