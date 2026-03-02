# Bot AI Costs - Claude Haiku 4.5

Analisi dettagliata dei costi per l'utilizzo del sistema Bot AI con **Claude Haiku 4.5** (modello attuale).

**Ultima revisione**: 17 Febbraio 2026
**Modello**: `claude-haiku-4-5-20251001`

---

## 📋 Executive Summary

| Metrica | Valore |
|---------|--------|
| **Costo per Sessione** (10 azioni) | **$0.02741** (~€0.0254) |
| **Costo per Azione** | **$0.00274** (~€0.00254) |
| **Token Totali** (sessione) | **49,850 token** |
| **Prezzo Input** | $0.25 / 1M token |
| **Prezzo Output** | $1.25 / 1M token |

### Riepilogo Rapido

✅ **Costo ultra-contenuto**: ~2.7 centesimi per sessione completa
✅ **Scalabilità eccellente**: Fino a 20 giocatori/giorno = €185/anno
✅ **ROI ottimo**: Qualità narrativa professionale a costo irrisorio

---

## 🔍 Analisi Tecnica del Flusso

### Chiamate API per Azione del Giocatore

Ogni azione del giocatore innesca 3 chiamate API sequenziali:

#### 1. Bot Decision (AI-Driven Selection)
**File**: `BotDecisionService.ts` + `BotSelectionService.ts`

| Fase | Max Tokens | Token Stimati | Costo* |
|------|------------|---------------|--------|
| **Prima Azione** (bot selection) | 750 | 2,050 | $0.00051 |
| **Azioni Successive** (locked bot) | 500 | 1,200 | $0.00030 |

*Costo medio considerando 70% input, 30% output

**Cosa fa**:
- Analizza il contesto multi-tag della location
- Seleziona il bot più appropriato per rispondere
- Valuta se il bot locked deve rispondere (azioni successive)

#### 2. Sentiment Analysis
**File**: `SentimentAnalysisService.ts`

| Max Tokens | Token Stimati | Costo* |
|------------|---------------|--------|
| 500 | 800 | $0.00020 |

**Cosa fa**:
- Analizza il tono e sentiment dell'azione del giocatore
- Calcola cambiamenti di trust, familiarità
- Identifica impatto emotivo (-10 a +10)

#### 3. Bot Response Generation
**File**: `ClaudeAgentService.ts`

| Max Tokens | Token Stimati | Costo* |
|------------|---------------|--------|
| 1024 | 2,900 | $0.00072 |

**Cosa fa**:
- Genera risposta in-character con personalità complessa
- Include psicologia (assi, ferita centrale, dualità)
- Considera memoria, relazioni, storico sessione
- Applica stile narrativo vittoriano (Agatha Christie-like)

---

## 📊 Breakdown Dettagliato per Sessione (10 Azioni)

### Token Usage

| Componente | Tipo | Token/Azione | Frequenza | Totale Token |
|------------|------|--------------|-----------|--------------|
| Bot Selection (prima azione) | Haiku | 2,050 | 1x | 2,050 |
| Bot Decision (locked, azioni 2-10) | Haiku | 1,200 | 9x | 10,800 |
| Sentiment Analysis | Haiku | 800 | 10x | 8,000 |
| Bot Response Generation | Haiku | 2,900 | 10x | 29,000 |
| **TOTALE SESSIONE** | | | | **49,850** |

### Distribuzione Input/Output

| Tipo | Token | Percentuale | Costo Unitario | Costo Totale |
|------|-------|-------------|----------------|--------------|
| **Input** | 34,895 | 70% | $0.25/1M | $0.00872 |
| **Output** | 14,955 | 30% | $1.25/1M | $0.01869 |
| **TOTALE** | 49,850 | 100% | - | **$0.02741** |

---

## 💰 Proiezioni di Costo

### Scenario 1: Singolo Giocatore
**Assunzione**: 1 sessione al giorno

| Periodo | Sessioni | Costo USD | Costo EUR* |
|---------|----------|-----------|------------|
| **Giornaliero** | 1 | $0.027 | €0.025 |
| **Settimanale** | 7 | $0.19 | €0.18 |
| **Mensile** | 30 | $0.82 | €0.76 |
| **Annuale** | 365 | $10.00 | €9.26 |

*Cambio: 1 USD = 0.926 EUR

### Scenario 2: Gruppo Piccolo (5 Giocatori)
**Assunzione**: 5 sessioni al giorno

| Periodo | Sessioni | Costo USD | Costo EUR |
|---------|----------|-----------|-----------|
| **Giornaliero** | 5 | $0.14 | €0.13 |
| **Settimanale** | 35 | $0.96 | €0.89 |
| **Mensile** | 150 | $4.11 | €3.81 |
| **Annuale** | 1,825 | $50.02 | €46.31 |

### Scenario 3: Gruppo Medio (20 Giocatori)
**Assunzione**: 20 sessioni al giorno

| Periodo | Sessioni | Costo USD | Costo EUR |
|---------|----------|-----------|-----------|
| **Giornaliero** | 20 | $0.55 | €0.51 |
| **Settimanale** | 140 | $3.84 | €3.55 |
| **Mensile** | 600 | $16.45 | €15.23 |
| **Annuale** | 7,300 | $200.07 | €185.25 |

### Scenario 4: Server Attivo (50 Giocatori)
**Assunzione**: 50 sessioni al giorno

| Periodo | Sessioni | Costo USD | Costo EUR |
|---------|----------|-----------|-----------|
| **Giornaliero** | 50 | $1.37 | €1.27 |
| **Settimanale** | 350 | $9.59 | €8.88 |
| **Mensile** | 1,500 | $41.12 | €38.06 |
| **Annuale** | 18,250 | $500.17 | €463.06 |

### Scenario 5: Server Large (100 Giocatori)
**Assunzione**: 100 sessioni al giorno

| Periodo | Sessioni | Costo USD | Costo EUR |
|---------|----------|-----------|-----------|
| **Giornaliero** | 100 | $2.74 | €2.54 |
| **Settimanale** | 700 | $19.19 | €17.77 |
| **Mensile** | 3,000 | $82.23 | €76.11 |
| **Annuale** | 36,500 | $1,000.35 | €926.12 |

---

## 📈 Grafico di Scala

```
Costi Annuali per Numero di Giocatori Attivi/Giorno (Haiku 4.5)

€1,000 ┤                                                    ●
       │
€ 750  ┤
       │
€ 500  ┤                                    ●
       │
€ 250  ┤                  ●
       │
€   0  ┼─────●───────●─────────────────────────────────────
       0     5      20        50                  100
                (Giocatori Attivi/Giorno)
```

**Nota**: Crescita lineare perfetta = scalabilità prevedibile

---

## ⚙️ Costi Non Ricorrenti

### Generazione Bot Iniziale

Quando si crea un nuovo bot con il sistema di generazione AI:

| Componente | Modello | Max Tokens | Token Stimati | Costo |
|------------|---------|------------|---------------|-------|
| Generazione Profilo | Haiku 4.5 | 2,048 | ~3,000 | $0.0015 |
| Traduzione Italiano | **Sonnet 4.5** | 2,048 | ~3,500 | $0.0600 |
| **TOTALE PER BOT** | | | | **$0.0615** |

**Frequenza**: Una tantum per bot
**Scenario tipico**: 10-20 bot per campagna = $0.62 - $1.23 (una tantum)

---

## 🎯 Ottimizzazioni Possibili

Se i costi dovessero diventare problematici (scenario 100+ giocatori):

### 1. Riduzione Max Tokens Output
**Da**: 1024 token → **A**: 750 token
- **Risparmio**: ~15%
- **Trade-off**: Risposte leggermente più brevi
- **Costo/sessione**: $0.0233 (-$0.0041)

### 2. Prompt Caching (Anthropic Feature)
**Cache**: System prompt bot (~1500 token)
- **Risparmio**: ~50% sui token input ripetuti
- **Trade-off**: Nessuno (feature gratuita)
- **Costo/sessione**: $0.0180 (-$0.0094)

### 3. Riduzione Storico Sessione
**Da**: 10 azioni → **A**: 5 azioni
- **Risparmio**: ~10%
- **Trade-off**: Memoria conversazione ridotta
- **Costo/sessione**: $0.0247 (-$0.0027)

### 4. Sentiment Analysis Ridotta
**Frequenza**: Ogni 2-3 azioni invece che ogni azione
- **Risparmio**: ~30% sul componente sentiment (~7% totale)
- **Trade-off**: Relazioni meno granulari
- **Costo/sessione**: $0.0255 (-$0.0019)

### 5. Ottimizzazione Aggressiva (Tutte insieme)
Combinando tutte le ottimizzazioni:
- **Costo/sessione**: ~$0.015
- **Risparmio**: ~45%
- **Trade-off**: Qualità leggermente ridotta

---

## 📊 Benchmarking vs Alternative

### Confronto con Altri Modelli/Servizi

| Soluzione | Costo/Sessione | Qualità | Velocità |
|-----------|----------------|---------|----------|
| **Haiku 4.5** (attuale) | $0.027 | ⭐⭐⭐⭐⭐ | ⚡⚡⚡⚡⚡ |
| Sonnet 4.5 | $0.349 | ⭐⭐⭐⭐⭐ | ⚡⚡⚡⚡ |
| GPT-4o | ~$0.120 | ⭐⭐⭐⭐ | ⚡⚡⚡⚡ |
| GPT-4o mini | ~$0.018 | ⭐⭐⭐ | ⚡⚡⚡⚡⚡ |

**Conclusione**: Haiku 4.5 offre il miglior rapporto qualità/prezzo/velocità

---

## 💡 Raccomandazioni

### ✅ Mantenere Setup Attuale (Haiku 4.5) Se:
- Utenti attivi giornalieri < 50
- Budget annuale bot AI < €500
- Qualità narrativa attuale è soddisfacente
- Velocità di risposta è critica

### ⚠️ Valutare Ottimizzazioni Se:
- Utenti attivi giornalieri > 50
- Budget annuale bot AI > €500
- Necessità di ridurre costi operativi

### 🔄 Valutare Sonnet 4.5 Se:
- Qualità narrativa deve migliorare significativamente
- Budget annuale bot AI > €1,000
- Velocità non è critica
- Consulta [model-comparison.md](model-comparison.md) per dettagli

---

## 📅 Monitoraggio Costi

### Dashboard Anthropic
Accedi alla [Anthropic Console](https://console.anthropic.com/) per:
- 📊 Usage statistics real-time
- 💰 Cost tracking mensile
- 📈 Trend analysis
- ⚠️ Budget alerts

### Metriche da Monitorare
1. **Cost per Session**: Dovrebbe rimanere ~$0.027
2. **Token Usage**: Verifica che non superi ~50k/sessione
3. **API Errors**: Rate limiting o failures
4. **Active Sessions per Day**: Per proiezioni accurate

---

## 🔗 Link Utili

- [Anthropic Pricing](https://www.anthropic.com/pricing) - Prezzi ufficiali aggiornati
- [Model Comparison](model-comparison.md) - Confronto Haiku vs Sonnet
- [Bot AI System Docs](../02-backend/botai-backend.md) - Documentazione tecnica
- [BotAI Backend README](../../services/botai-backend/README.md) - Setup e deployment

---

## 📝 Note

**Disclaimer**: I costi indicati sono stime basate su usage patterns tipici. I costi effettivi possono variare in base a:
- Lunghezza delle risposte dei giocatori
- Complessità delle conversazioni
- Numero di bot attivi per location
- Frequenza di sentiment analysis
- Dimensione dello storico sessione

**Aggiornamento Prezzi**: I prezzi Claude API possono cambiare. Verifica sempre i prezzi ufficiali su [anthropic.com/pricing](https://www.anthropic.com/pricing).

**Data ultimo aggiornamento**: 17 Febbraio 2026
