# TenpennyNovels - Pricing Strategy

**Data**: 2026-02-06
**Status**: Draft - In discussione

## Panoramica

Questa cartella contiene la strategia di monetizzazione per TenpennyNovels, una piattaforma RPG by chat ambientata nella Londra Vittoriana.

## Modello di Business

**Open Source + Hosted Service**

- **Self-Hosted**: Codice open source gratuito su GitHub
- **Managed Hosting**: Servizio a pagamento gestito da noi

Il modello permette di:
- Non rimetterci soldi (no free tier hosted)
- Generare revenue da chi vuole comodità
- Mantenere community open source attiva

## Struttura Documentazione

1. **[Business Model](01-business-model.md)** - Filosofia e approccio generale
2. **[Pricing Tiers](02-pricing-tiers.md)** - Piani di abbonamento (STARTER, PRO, ENTERPRISE, CUSTOM)
3. **[Location Features](03-location-features.md)** - Sistema location private e features base
4. **[Add-ons Catalog](04-addons-catalog.md)** - Catalogo completo add-ons disponibili
5. **[Revenue Projections](05-revenue-projections.md)** - Proiezioni economiche e scenari
6. **[Implementation Notes](06-implementation-notes.md)** - Note tecniche per implementazione

## Principi Chiave

### 1. Sostenibilità Economica
- Nessun tier gratuito hosted (costi server sempre coperti)
- Free = self-hosting (costo zero per noi)
- Tutti i tier hosted hanno margine positivo

### 2. Pricing Basato su Costi Reali
- **Utenti concorrenti**: Determina carico server
- **Bot AI calls**: Costo API Claude variabile
- **Storage**: Costo infrastruttura crescente

### 3. Modello Modulare
- **Base subscription**: Hosting + features base
- **Add-ons**: Features avanzate acquistabili separatamente (one-time)
- **Bundles**: Pacchetti add-ons scontati

### 4. Location Private
- **Illimitate per tutti** (no costo aggiuntivo)
- Features base incluse (invito, acquisto, customizzazione)
- Features avanzate = add-ons a pagamento

### 5. Bot AI come Premium Feature
- **STARTER**: No Bot AI
- **PRO**: Bot AI incluso (killer feature per upgrade)
- **ENTERPRISE+**: Bot AI potenziato + custom

## Target Clienti

### Self-Hosted (Free)
- Developer che vogliono customizzare
- Gruppi tecnici con server proprio
- Budget zero
- Privacy-conscious

### STARTER (€15/mese)
- Gruppi piccoli (5-10 giocatori)
- Solo giocatori umani (no bot)
- Budget contenuto
- Casuali

### PROFESSIONAL (€45/mese) ⭐
- Gruppi medi (10-30 giocatori)
- Vogliono Bot AI NPC
- Master seri
- Campagne immersive

### ENTERPRISE (€119/mese)
- Community grandi (30-100 giocatori)
- Heavy bot usage
- Esigenze performance
- White-label

### CUSTOM (€249+/mese)
- Associazioni, scuole
- Uso commerciale
- Esigenze specifiche
- Account manager dedicato

## Quick Reference

| Tier | Prezzo | Concurrent Users | Bot AI | Storage |
|------|--------|------------------|--------|---------|
| Self-Host | €0 | ∞ | ∞* | ∞ |
| STARTER | €15/mese | 20 | ❌ | 5GB |
| PRO | €45/mese | 50 | ✅ 2000 msg | 25GB |
| ENTERPRISE | €119/mese | 150 | ✅ 8000 msg | 100GB |
| CUSTOM | €249+/mese | 300+ | ✅ 20000+ msg | 500GB+ |

*Se self-host devi gestire le tue API key Claude

## Add-ons Disponibili

| Add-on | Prezzo | Descrizione |
|--------|--------|-------------|
| Housing System | €49 | Affitti, contratti, auto-collect |
| Key & Access | €29 | Chiavi fisiche, lockpicking, log accessi |
| Smart Permissions | €19 | Accesso basato su occupazione/classe/fazione |
| Dynamic Environments | €39 | Location che cambiano nel tempo |
| Location Economy | €59 | Business simulation per location |
| Multi-Room System | €29 | Location con stanze multiple |
| Custom Scripting | €99 | JavaScript custom per location |

## Revenue Model

### Anno 1 (Bootstrap)
- 15 STARTER + 5 PRO + 1 ENTERPRISE
- **MRR**: €659/mese
- **Profitto**: €479/mese (~€5,750/anno)

### Anno 2-3 (Crescita)
- 40 STARTER + 15 PRO + 5 ENTERPRISE + 1 CUSTOM
- **MRR**: €2,389/mese
- **Profitto**: €1,489/mese (~€17,900/anno)

### Anno 4-5 (Maturità)
- 80 STARTER + 30 PRO + 12 ENTERPRISE + 3 CUSTOM
- **MRR**: €5,285/mese
- **Profitto**: €3,285/mese (~€39,400/anno)

## Prossimi Passi

1. **Validazione pricing** con potenziali clienti
2. **Scelta licenza** open source (MIT vs AGPL)
3. **Implementazione tecnica**:
   - Sistema subscription (Stripe)
   - Feature flags per add-ons
   - Rate limiting (concurrent users, Bot AI)
   - Usage tracking dashboard
4. **Landing page** con pricing
5. **Documentazione** self-hosting
6. **Beta testing** con early adopters

## Note

- Pricing in EUR (mercato principale: Italia/Europa)
- Possibilità di annual billing con sconto (es: 15% off)
- Trial period: 14 giorni gratis per PRO/ENTERPRISE
- Money-back guarantee: 30 giorni
