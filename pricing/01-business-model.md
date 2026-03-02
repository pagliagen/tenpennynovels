# Business Model - Open Source + Managed Hosting

## Filosofia

TenpennyNovels adotta il modello **"Open Core + Managed Hosting"**, lo stesso usato con successo da:
- **GitLab**: Free self-hosted, paid hosted service
- **Ghost**: Free self-hosted CMS, paid managed hosting
- **Discourse**: Free forum software, paid hosting

## Perché Questo Modello?

### ✅ Vantaggi

1. **Zero Free-Tier Hosted Cost**
   - Non paghiamo server per utenti gratuiti
   - Ogni cliente hosted genera profitto
   - Sostenibilità economica garantita

2. **Community Open Source**
   - Codice visibile = fiducia
   - Contributi esterni possibili
   - Marketing virale (GitHub stars, social proof)
   - Developer adoption più facile

3. **Doppio Target**
   - **Technical users**: Self-hosting gratuito
   - **Non-technical users**: Pagano per comodità

4. **Vendor Lock-In Ridotto**
   - Cliente può sempre migrare a self-hosted
   - Dati esportabili
   - No paura di "essere intrappolati"

5. **Revenue Diversificato**
   - Subscription ricorrente (MRR)
   - Add-ons one-time (cash flow immediato)
   - Possibile marketplace future (revenue share)

### ⚠️ Rischi e Mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Competitor fork il codice | Licenza AGPL (fork devono rimanere open) |
| Tutti fanno self-host (no revenue) | Hosting comodo > gestione server fai-da-te |
| Feature sviluppate da altri gratis | Welcome! Miglioriamo tutti il prodotto |
| Costi server sottostimati | Pricing basato su costi reali + margine |

## Struttura del Modello

### 1. Self-Hosted (Gratuito)

**Cosa offriamo**:
- ✅ Codice completo su GitHub
- ✅ Documentazione setup dettagliata
- ✅ Docker Compose per deploy rapido
- ✅ Community support (GitHub Issues, Discord)
- ✅ Guide troubleshooting

**Cosa NON offriamo**:
- ❌ Support 1-on-1
- ❌ Server hosting
- ❌ Backup gestiti
- ❌ Uptime guarantee
- ❌ Bot AI key (devono gestire le loro)

**Costo per noi**: €0

**Target**:
- Developer che vogliono customizzare
- Gruppi con competenze tecniche
- Chi ha già server disponibile
- Privacy-conscious (dati sul proprio server)
- Budget zero

### 2. Managed Hosting (A Pagamento)

**Cosa offriamo**:
- ✅ Server gestito da noi
- ✅ Setup istantaneo (5 minuti)
- ✅ Backup automatici
- ✅ Uptime monitoring
- ✅ Security updates automatici
- ✅ Bot AI incluso (tier PRO+)
- ✅ Support tecnico
- ✅ Scaling automatico

**Cosa il cliente NON deve fare**:
- ❌ Gestire server
- ❌ Configurare database
- ❌ Fare backup manualmente
- ❌ Debuggare problemi infra
- ❌ Gestire API keys Claude

**Costo per noi**: €X/mese (coperto da subscription)

**Target**:
- Master che vogliono giocare, non sistemisti
- Gruppi non-tecnici
- Chi vuole affidabilità garantita
- Chi non ha tempo per gestire server
- Chi vuole support quando serve

## Value Proposition Hosted vs Self-Hosted

### Perché Pagare Invece di Self-Hostare?

| Aspetto | Self-Hosted | Managed Hosting |
|---------|-------------|-----------------|
| **Setup time** | 2-3 ore | 5 minuti |
| **Manutenzione** | Continua (aggiornamenti, patch) | Zero |
| **Backup** | Manuale o script custom | Automatico giornaliero |
| **Uptime** | "Speriamo non cada" | 99%+ garantito |
| **Support** | Community (risposta variabile) | Email/Chat (24-72h) |
| **Bot AI** | Devi gestire API Claude | Incluso e gestito |
| **Scaling** | Devi upgrading server manualmente | Automatico |
| **Costo tempo** | 2-5 ore/mese manutenzione | 0 ore |

**ROI Calculation**:
- Tempo sysadmin: 3 ore/mese
- Costo orario sysadmin: €25-50/ora
- **Costo tempo**: €75-150/mese
- **Hosted PRO**: €45/mese

**Saving**: €30-105/mese scegliendo hosted!

### Conversion Funnel

```
┌─────────────────┐
│  Discover on    │
│  GitHub/Reddit  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Try Self-Host  │  ← 1000 developers
│   (Docker)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  "This is cool  │
│  but annoying   │  ← 200 interested
│  to maintain"   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Start STARTER  │  ← 30 conversions (15%)
│   €15/mese      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Need Bot AI    │  ← 10 upgrades (33%)
│  Upgrade to PRO │
└─────────────────┘
```

**Key Metrics**:
- **Discovery → Try**: 10% (1000 → 100)
- **Try → Interested**: 20% (100 → 20)
- **Interested → Convert**: 15% (20 → 3)
- **STARTER → PRO**: 33% (3 → 1)

## Licenza Open Source

### Opzioni Valutate

#### 1. MIT License ✅ (Consigliata)
**Pro**:
- Massima libertà per utenti
- Attraente per developer
- Permette uso commerciale senza restrizioni
- Più star su GitHub (social proof)

**Contro**:
- Competitor possono fare fork closed-source
- Meno protezione

**Conclusione**: Va bene! Se qualcuno forka e fa competitor closed-source:
- Noi abbiamo vantaggio first-mover
- Community ci preferisce (transparent)
- Nostro hosted service è superior (esperienza, support)

#### 2. AGPL License
**Pro**:
- Fork devono rimanere open source
- Hosted service competitor devono condividere codice
- Protegge da "take and close"

**Contro**:
- Meno adozioni (aziende temono AGPL)
- Perceived come "meno free"
- Meno contributor esterni

**Conclusione**: Overkill per il nostro caso

#### 3. Dual License (MIT + Commercial)
**Pro**:
- Free per non-profit, paid per commerciale
- Revenue extra da licensing

**Contro**:
- Complesso da gestire
- Confonde utenti
- Enforcement difficile

**Conclusione**: Non necessario ora

### 🎯 Scelta Finale: MIT License

Motivi:
1. Semplicità
2. Massima adoption
3. No fear of "legal traps"
4. Competitive advantage è hosted service, non codice

## Revenue Streams

### 1. Subscription (MRR - Monthly Recurring Revenue)

| Tier | Prezzo | Target % Clienti | MRR (50 clienti) |
|------|--------|------------------|------------------|
| STARTER | €15 | 60% | €450 |
| PRO | €45 | 30% | €675 |
| ENTERPRISE | €119 | 8% | €476 |
| CUSTOM | €249 | 2% | €249 |
| **TOTAL** | - | 100% | **€1,850** |

**Churn rate target**: <5% mensile (ottimo per B2B)

### 2. Add-ons (One-Time Revenue)

| Add-on | Prezzo | Purchase Rate | Revenue (50 clienti) |
|--------|--------|---------------|----------------------|
| Housing System | €49 | 20% | €490 |
| Key & Access | €29 | 15% | €217.5 |
| Location Economy | €59 | 10% | €295 |
| Bundles (avg) | €129 | 10% | €645 |
| **TOTAL** | - | - | **€1,647.5** |

**Annual run-rate** (one-time): €1,647 in Year 1, poi diminuisce

### 3. Future Revenue Streams (Roadmap)

- **Marketplace**: 30% revenue share su contenuti venduti da creator
- **Custom Development**: €100-500 per feature custom
- **White-Label Enterprise**: Setup fee €500-2000
- **Training/Workshops**: €200-500 per sessione

## Competitive Positioning

### Competitor Comparison

| Platform | Model | Pricing | Self-Host |
|----------|-------|---------|-----------|
| **Roll20** | Freemium SaaS | €0-10/mese | ❌ No |
| **Foundry VTT** | One-time license | €50 once | ✅ Sì |
| **Fantasy Grounds** | Subscription | €10-15/mese | ❌ No |
| **TenpennyNovels** | Open + Hosted | €0-119/mese | ✅ Sì |

**Unique Selling Points**:
1. ✅ **Open Source** (unico tra competitor VTT)
2. ✅ **Victorian London** (nicchia specifica)
3. ✅ **Chat-based** (no virtual tabletop, focus RP)
4. ✅ **Bot AI** (NPC intelligenti con Claude)
5. ✅ **Self-host option** (data ownership)

## Go-To-Market Strategy

### Phase 1: Open Source Launch (Month 1-3)
- Publish su GitHub con MIT license
- Documentazione setup completa
- Docker Compose one-click deploy
- Community Discord
- Reddit posts su r/rpg, r/callofcthulhu, r/selfhosted

**Goal**: 100 GitHub stars, 20 self-hosted deployments

### Phase 2: Hosted Beta (Month 4-6)
- Landing page con pricing
- Stripe integration
- Beta invites per early adopters
- Free trial 14 giorni
- Collect feedback

**Goal**: 10 paying customers (€200-400 MRR)

### Phase 3: Public Launch (Month 7-12)
- Public hosting availability
- Add-ons marketplace launch
- Content marketing (blog, guide, video)
- Partnerships con community Call of Cthulhu Italia

**Goal**: 50 paying customers (€1,500-2,500 MRR)

### Phase 4: Scale (Year 2+)
- Advanced features
- Mobile app
- Marketplace third-party content
- International expansion (EN, ES, FR)

**Goal**: 200+ customers (€6,000-10,000 MRR)

## Success Metrics

### Key Performance Indicators (KPI)

| Metric | Target Year 1 | Target Year 2 | Target Year 3 |
|--------|---------------|---------------|---------------|
| **GitHub Stars** | 500 | 1,500 | 3,000 |
| **Self-Hosted Installs** | 50 | 200 | 500 |
| **Paying Customers** | 50 | 150 | 300 |
| **MRR** | €1,500 | €4,500 | €9,000 |
| **Churn Rate** | <8% | <5% | <3% |
| **LTV/CAC Ratio** | 2:1 | 3:1 | 5:1 |
| **Add-ons Revenue** | €2,000 | €5,000 | €10,000 |

### Unit Economics

**Customer Acquisition Cost (CAC)**:
- Organic (GitHub, Reddit, SEO): €0-10
- Paid ads (future): €30-50

**Customer Lifetime Value (LTV)**:
- STARTER: €15 × 18 months = €270
- PRO: €45 × 24 months = €1,080
- ENTERPRISE: €119 × 36 months = €4,284

**LTV/CAC Ratio**: 27:1 a 85:1 (eccellente!)

**Payback Period**: <1 mese (subscription immediatamente profittevole)

## Conclusioni

Il modello **Open Source + Managed Hosting** è ideale per TenpennyNovels perché:

1. ✅ **Sostenibile**: No costi free tier
2. ✅ **Scalabile**: Community + paid customers
3. ✅ **Competitivo**: Unique nel mercato RPG
4. ✅ **Flessibile**: Self-host o hosted a scelta
5. ✅ **Profittevole**: Margini 40-70% su tier hosted

**Risk Level**: Basso (no investimenti iniziali grandi, validation incrementale)

**Time to Profitability**: 3-6 mesi (break-even con 30-40 clienti)
