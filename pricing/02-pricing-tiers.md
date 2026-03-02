# Pricing Tiers - Managed Hosting

## Filosofia Pricing

**Basato su costi reali**:
- Utenti concorrenti online → carico server
- Bot AI calls → costo API Claude
- Storage → costo database/backup

**No limiti artificiali**:
- Location private: Illimitate per tutti (costo zero)
- Personaggi: Illimitati per tutti (solo dati)
- Admin tools: Disponibili per tutti

**Upgrade path chiaro**:
- STARTER → PRO: Bot AI (killer feature)
- PRO → ENTERPRISE: Server dedicato + scaling
- ENTERPRISE → CUSTOM: Needs specifici

---

## Self-Hosted (FREE)

### Cosa Ottieni

**Software**:
- ✅ Codice completo (MIT License)
- ✅ Docker Compose setup
- ✅ Documentazione completa
- ✅ Community support

**Limiti tecnici**:
- ❌ Nessuno (sei tu il proprietario)

**Cosa Devi Gestire**:
- Server/VPS (es: OVH, Hetzner, AWS)
- Database (MongoDB)
- Redis
- Backup
- Security updates
- API keys Claude (per Bot AI)
- SSL certificates
- Monitoring

**Costo Stimato**:
- VPS base: €5-15/mese (Hetzner, OVH)
- VPS medio: €15-40/mese
- VPS potente: €40-100/mese
- + Tempo manutenzione: 2-5 ore/mese

**Costo per noi**: €0

**Target**:
- Developer
- Gruppi tecnici
- Chi ha già infrastruttura
- Privacy-conscious
- Budget zero

---

## STARTER (€15/mese)

### 💡 Positioning
*"Hosting semplice senza fronzoli - Perfetto per iniziare"*

### Specifiche Tecniche

**Infrastruttura**:
- **Utenti concorrenti**: Max 20 online contemporaneamente
- **Storage**: 5GB (database + file)
- **Bandwidth**: 50GB/mese
- **Server**: VPS condiviso (multi-tenant)
- **CPU**: Shared
- **RAM**: Shared pool

**Features**:
- ✅ **Location private**: Illimitate
- ✅ **Location features base**: Invito, acquisto, customizzazione
- ✅ **Personaggi**: Illimitati
- ✅ **Admin tools**: Full access
- ✅ **WebSocket**: Real-time chat
- ✅ **Documenti**: Accesso completo
- ✅ **Forum**: Accesso completo
- ❌ **Bot AI**: Non incluso

**Support & SLA**:
- Email support (72h response time)
- Documentazione online
- Uptime: Best effort (~98%)
- Backup: Giornalieri automatici (retention 7 giorni)
- Export: Manuale (1 volta/settimana)

### Limitazioni

**Hard Limits** (enforcement tecnico):
- 20 utenti concorrenti (21° viene respinto con messaggio)
- 5GB storage (upload bloccato se superato)
- No Bot AI features (UI nascosta)

**Soft Limits** (monitoring + notifiche):
- Bandwidth: Warning al 80%, throttle al 100%

### Costi & Margini

**Costo per noi**:
- VPS slot: €4-5/mese
- Backup storage: €0.50/mese
- Support: €1/mese (ammortized)
- **Totale**: €5.50-6.50/mese

**Margine**: €8.50-9.50/mese (57-63%)

### Target Cliente

**Ideal Customer**:
- Gruppo di 5-10 giocatori
- 1-2 sessioni/settimana
- Preferiscono solo giocatori umani (no bot)
- Budget contenuto
- Non vogliono gestire server

**Use Cases**:
- Gruppo amici che gioca casual
- Testing platform prima di upgrade
- Campagna corta/one-shot

### Add-ons Consigliati

Starter è base, ma può aggiungere:
- **Key & Access System** (€29): Se vogliono chiavi fisiche
- **Smart Permissions** (€19): Per accessi basati su occupazione

**Bundle Suggerito**: Landlord Bundle (€99) se vogliono housing completo

---

## PROFESSIONAL (€45/mese) ⭐

### 💡 Positioning
*"Il vero gioco inizia qui - Bot AI inclusi!"*

**Badge**: "Most Popular" / "Best Value"

### Specifiche Tecniche

**Infrastruttura**:
- **Utenti concorrenti**: Max 50 online contemporaneamente
- **Storage**: 25GB
- **Bandwidth**: 150GB/mese
- **Server**: VPS condiviso (ottimizzato)
- **CPU**: Priority queue (meno lag)
- **RAM**: Reserved pool

**Features**:
- ✅ **Tutto STARTER** +
- ✅ **Bot AI**: 2000 messaggi/mese (~€6-30 costo API)
- ✅ **Bot AI custom**: Genera fino a 10 bot personalizzati
- ✅ **Analytics dashboard**: Utenti, sessioni, engagement
- ✅ **White-label parziale**: Logo custom, colori, nome istanza
- ✅ **Session recording** (beta): Salva e rivedi sessioni

**Support & SLA**:
- Email support (24h response)
- Live chat support (orario ufficio)
- Uptime: 99% SLA
- Backup: Giornalieri (retention 30 giorni)
- Export: On-demand illimitati

**Add-on Incluso**:
- 🎁 **Housing System** (€49 value) - GRATIS!

### Limitazioni

**Hard Limits**:
- 50 utenti concorrenti
- 25GB storage
- 2000 Bot AI messaggi/mese (poi disabilitato fino a reset mensile)
- 10 bot custom max

**Soft Limits**:
- Bandwidth: Throttle al 100%

### Costi & Margini

**Costo per noi**:
- VPS slot: €12-15/mese
- Bot AI calls: €6-12/mese (media)
- Backup storage: €1.50/mese
- Support: €2/mese (ammortized)
- **Totale**: €21.50-30.50/mese

**Margine**: €14.50-23.50/mese (32-52%)

### Target Cliente

**Ideal Customer**:
- Gruppo di 10-30 giocatori
- 2-4 sessioni/settimana
- Vogliono NPC AI immersivi
- Master serio/appassionato
- Disposti a pagare per quality experience

**Use Cases**:
- Campagna lunga (6+ mesi)
- Master che vuole NPC intelligenti
- Community piccola ma attiva
- Taverna con bot barista, investigazioni con bot testimoni

### Add-ons Consigliati

PRO è già completo, ma può aggiungere:
- **Location Economy** (€59): Per business simulation
- **Dynamic Environments** (€39): Location che cambiano
- **Multi-Room System** (€29): Mansion, dungeon multi-stanza

**Bundle Suggerito**: Business Owner Bundle (€129) per economia complessa

### Upgrade Path

**Da STARTER a PRO**:
- Trigger: "Vuoi provare Bot AI? Upgrade ora!"
- In-app notification quando creano location dove bot avrebbe senso
- Free trial Bot AI: 7 giorni, 100 messaggi

**Da PRO a ENTERPRISE**:
- Trigger: Superano spesso 40 utenti concorrenti
- Vogliono white-label completo
- Hanno bisogno di più bot messages

---

## ENTERPRISE (€119/mese)

### 💡 Positioning
*"Server dedicato, Bot AI illimitati, Performance garantita"*

### Specifiche Tecniche

**Infrastruttura**:
- **Utenti concorrenti**: Max 150 online contemporaneamente
- **Storage**: 100GB
- **Bandwidth**: 500GB/mese
- **Server**: Dedicato (single-tenant)
- **CPU**: 4 vCPU dedicati
- **RAM**: 8GB dedicati

**Features**:
- ✅ **Tutto PRO** +
- ✅ **Bot AI**: 8000 messaggi/mese
- ✅ **Bot AI custom**: Illimitati
- ✅ **Bot AI avanzato**: Memoria persistente, prompt tuning
- ✅ **Location private**: Illimitate (già in PRO)
- ✅ **White-label completo**: Dominio custom, logo, branding
- ✅ **API access**: REST API per integrazioni esterne
- ✅ **Webhooks**: Automazioni custom
- ✅ **Advanced analytics**: Export dati, grafici custom
- ✅ **Priority processing**: Queue privilegiata

**Support & SLA**:
- Email support (12h response)
- Live chat prioritario
- Video call mensile con team
- Uptime: 99.5% SLA
- Backup: Real-time + disaster recovery
- Export: Automated daily

**Add-ons Inclusi**:
- 🎁 **Housing System** (€49)
- 🎁 **Key & Access** (€29)
- 🎁 **Smart Permissions** (€19)
- **Total value**: €97 gratis!

### Limitazioni

**Hard Limits**:
- 150 utenti concorrenti
- 100GB storage
- 8000 Bot AI messaggi/mese

**Soft Limits**:
- Bandwidth: Throttle gentile al 100%

### Costi & Margini

**Costo per noi**:
- Server dedicato OVH: €40-50/mese
- Bot AI calls: €24-40/mese (media)
- Backup storage: €3/mese
- Dominio: €10/anno (€0.83/mese)
- Support: €5/mese (ammortized)
- **Totale**: €72.83-98.83/mese

**Margine**: €20.17-46.17/mese (17-39%)

### Target Cliente

**Ideal Customer**:
- Community grande (30-100 giocatori attivi)
- 5-10 sessioni/settimana parallele
- Heavy Bot AI usage
- Esigenze performance critiche
- Want full control & branding

**Use Cases**:
- Associazione GDR con 50+ membri
- Server Discord pubblico con gioco integrato
- Community internazionale
- Multiple campagne simultanee

### Add-ons Consigliati

Enterprise è quasi completo, ma può aggiungere:
- **Master's Complete Pack upgrade** (€99 invece di €199)
  - Include: Location Economy, Dynamic Environments, Multi-Room, Custom Scripting

### Upgrade Path

**Da PRO a ENTERPRISE**:
- Trigger: Superano 45 utenti concorrenti regolarmente
- Finiscono spesso Bot AI quota mensile
- Richiedono white-label completo
- Performance issues (lag su VPS condiviso)

**Da ENTERPRISE a CUSTOM**:
- Trigger: Superano 120-130 utenti concorrenti
- Esigenze specifiche non coperte
- Multi-tenancy (più "mondi" isolati)
- Custom development necessario

---

## CUSTOM (€249+/mese)

### 💡 Positioning
*"Tutto è possibile - Soluzione su misura"*

### Specifiche Tecniche

**Infrastruttura**:
- **Utenti concorrenti**: 300+ (scalabile dinamicamente)
- **Storage**: 500GB+ (espandibile)
- **Bandwidth**: Illimitato
- **Server**: Dedicato premium o cluster multi-server
- **CPU**: 8+ vCPU
- **RAM**: 16GB+
- **Multi-region**: Opzionale (EU + US)

**Features**:
- ✅ **Tutto ENTERPRISE** +
- ✅ **Bot AI**: 20,000+ messaggi/mese o pay-per-use
- ✅ **Multi-tenancy**: Più "mondi" isolati
- ✅ **Custom development**: Feature su richiesta
- ✅ **SSO/LDAP integration**: Auth enterprise
- ✅ **Compliance**: GDPR, SOC2 se necessario
- ✅ **Disaster recovery**: Multi-region backup
- ✅ **Account manager**: Contatto dedicato

**Support & SLA**:
- Priority support (4h response)
- Slack channel dedicato
- Video call settimanali
- On-call support (opzionale)
- Uptime: 99.9% SLA
- Backup: Real-time multi-region

**Add-ons Inclusi**:
- 🎁 **Master's Complete Pack** (€323 value)
- Tutti gli add-ons attuali + futuri

### Pricing

**Base**: €249/mese

**Variable**:
- +€50/mese per ogni 100 utenti concorrenti oltre 300
- +€0.01 per Bot AI message oltre 20,000
- +€10 per ogni 100GB storage oltre 500GB

**Setup Fee**: €500-2,000 (custom development, migration, training)

### Costi & Margini

**Costo per noi**:
- Server dedicato premium: €80-120/mese
- Bot AI calls: €60-100/mese
- Backup multi-region: €10/mese
- Account manager: €30/mese (partial allocation)
- Support dedicato: €20/mese
- **Totale**: €200-280/mese

**Margine**: €49-169/mese (20-40%) + setup fee

### Target Cliente

**Ideal Customer**:
- Organizzazioni (associazioni, scuole, università)
- Uso commerciale (piattaforma RPG branded)
- 100-500+ giocatori
- Esigenze compliance/security
- Budget per custom development

**Use Cases**:
- Associazione nazionale GDR con migliaia di membri
- Scuola che usa RPG per didattica
- Azienda che vuole RPG branded per team building
- Piattaforma white-label per altre ambientazioni

### Contract

**Durata**: Annual contract (12 mesi minimo)
**Payment**: Quarterly o annual prepaid
**SLA**: Contratto personalizzato
**Termination**: 60 giorni notice

---

## Confronto Rapido

| Feature | STARTER €15 | PRO €45 ⭐ | ENTERPRISE €119 | CUSTOM €249+ |
|---------|-------------|-----------|-----------------|--------------|
| **Concurrent users** | 20 | 50 | 150 | 300+ |
| **Storage** | 5GB | 25GB | 100GB | 500GB+ |
| **Bot AI msg/mese** | ❌ | 2K | 8K | 20K+ |
| **Bot custom** | ❌ | 10 | ∞ | ∞ |
| **Server** | Shared | Shared | Dedicated | Dedicated+ |
| **White-label** | ❌ | Partial | Full | Full |
| **Custom domain** | ❌ | ❌ | ✅ | ✅ |
| **API access** | ❌ | ❌ | ✅ | ✅ |
| **Uptime SLA** | ~98% | 99% | 99.5% | 99.9% |
| **Support** | Email 72h | Email 24h + chat | Email 12h + call | Dedicated 4h |
| **Add-ons inclusi** | - | Housing | Housing+Keys+Perms | All |

---

## Annual Billing Discount

**Sconto 15%** se pagamento annuale anticipato:

| Tier | Mensile | Annuale (12 mesi) | Saving |
|------|---------|-------------------|--------|
| STARTER | €15 × 12 = €180 | **€153** (€12.75/mese) | €27 |
| PRO | €45 × 12 = €540 | **€459** (€38.25/mese) | €81 |
| ENTERPRISE | €119 × 12 = €1,428 | **€1,214** (€101.17/mese) | €214 |

**Vantaggi annual**:
- Cash flow immediato per noi
- Lock-in cliente per 12 mesi (riduce churn)
- Cliente risparmia
- Predictable revenue

---

## Free Trial

### PRO & ENTERPRISE: 14 giorni gratis

**Cosa include**:
- Full features del tier
- No carta di credito richiesta per iniziare
- Carta richiesta prima della fine trial
- Cancellazione facile

**Conversione target**: 40-60% da trial a paid

### STARTER: No trial

Motivi:
- Prezzo già basso (€15)
- Evita abuse (account multipli per trial)
- Conversion diretta

---

## Garanzie

### Money-Back Guarantee - 30 giorni

Se non soddisfatto entro 30 giorni:
- Rimborso completo primo mese
- Nessuna domanda (no questions asked)
- Export dati garantito

**Refund rate target**: <2% (se >5% c'è problema prodotto)

---

## Upgrade/Downgrade Policy

### Upgrade (Immediate)
- Effetto immediato
- Prorate billing (paghi differenza proporzionale)
- Features si abilitano subito

### Downgrade (End of Period)
- Effetto a fine periodo billing corrente
- No refund periodo corrente
- Grace period 7 giorni per export dati extra

### Cancellazione
- Effetto a fine periodo billing
- Export dati disponibile 30 giorni post-cancellazione
- Re-attivazione possibile entro 90 giorni (dati conservati)

---

## Prossimi Passi

1. **Validare pricing** con survey clienti potenziali
2. **A/B test** prezzi (€15 vs €19 per STARTER)
3. **Implement** feature flags per tier
4. **Build** pricing page
5. **Stripe integration** per billing
