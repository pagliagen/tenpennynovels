# AI & Machine Learning

**Navigation**: [Home](../INDEX.md) > AI & ML

**Status**: ✅ Production Ready | **Last Updated**: 2026-03-01

Sistemi AI e ML: embeddings, semantic search, bot psychology.

---

## Overview

TenpennyNovels integra machine learning per semantic search e AI (Claude) per NPC bot intelligenti con psychology system avanzata.

---

## Systems

### Embeddings Architecture

**Purpose**: Vector generation per semantic search su documenti e location actions.

**Components**:
- **Embeddings Service** (Flask, port 5001) - ML service
- **Embeddings Worker** (Node.js, Bull queue) - Async processor
- **Qdrant** (Vector DB, port 6333) - ANN search

**Model**: `paraphrase-multilingual-MiniLM-L12-v2` (384D)

**Performance**: ~100ms per embedding, <100ms ANN search

**File**: [Embeddings Architecture](./embeddings-architecture.md)

---

### Semantic Search

**Purpose**: Search documents by meaning, not just keywords.

**Architecture**:
- **L1 Search**: Full-text MongoDB search (keyword-based)
- **L2 Search**: Vector similarity Qdrant search (semantic)
- **Dual Results**: Merge L1 + L2 con ranking

**Use Cases**:
- Document search in Documents app
- Location action search (future)
- Bot memory retrieval

**File**: [Semantic Search](./semantic-search.md)

---

### BotAI Psychology System

**Purpose**: Advanced NPC psychology per bot behavior realistico.

**Features**:
- **6 Psychology Axes** (-3 to +3): Rational/Emotional, Controlled/Impulsive, Cynical/Idealist, Proud/Submissive, Prudent/Paranoid, Direct/Allusive
- **Central Wound**: Deep psychological trauma driving behavior
- **Duality System**: Public mask vs private truth (trust-based reveal)
- **Relationship Archetypes**: Mentor, rival, romantic, suspicious

**File**: [BotAI Psychology](./botai-psychology.md)

---

### BotAI Costs & Optimization

**Purpose**: Cost analysis e optimization strategies per Claude API usage.

**Key Metrics**:
- ~$0.007 per interaction (2 bot responses)
- 50% cost reduction vs baseline (no optimization)
- ~100ms embedding generation overhead

**Optimizations**:
- Semantic memory (vs full context window)
- Single-line responses (vs multi-paragraph)
- Cached system prompts
- Relationship archetype shortcuts

**File**: [BotAI Costs](./botai-costs.md)

---

## Files in This Section

- [README.md](./README.md) - This file
- [Embeddings Architecture](./embeddings-architecture.md) - Vector generation pipeline
- [Semantic Search](./semantic-search.md) - Dual-level search
- [BotAI Psychology](./botai-psychology.md) - Psychology system
- [BotAI Costs](./botai-costs.md) - Cost optimization

---

## Related Documentation

- [BotAI Backend](../02-backend/botai-backend.md) - Backend implementation
- [Infrastructure](../01-infrastructure/README.md) - Qdrant, embeddings service
- [Documents App](../05-frontend/documents-app.md) - Search UI
