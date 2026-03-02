# Implementation Notes - Technical Roadmap

## Overview

Questo documento descrive l'implementazione tecnica del sistema di pricing, subscription, feature flags, e add-ons.

---

## Phase 1: Foundation (Month 1-2)

### 1.1 Subscription System

**Obiettivo**: Stripe integration per billing ricorrente

**Tasks**:
1. **Stripe Setup**
   - Account Stripe (production + test)
   - Create Products in Stripe:
     - STARTER (€15/month)
     - PROFESSIONAL (€45/month)
     - ENTERPRISE (€119/month)
     - CUSTOM (€249/month)
   - Annual billing plans (15% discount)

2. **Database Schema**
   ```typescript
   // New collection: subscriptions
   interface Subscription {
     _id: ObjectId;
     userId: ObjectId;
     tier: 'starter' | 'pro' | 'enterprise' | 'custom';
     status: 'active' | 'past_due' | 'canceled' | 'trialing';

     // Stripe data
     stripeCustomerId: string;
     stripeSubscriptionId: string;
     stripePriceId: string;

     // Billing
     currentPeriodStart: Date;
     currentPeriodEnd: Date;
     cancelAtPeriodEnd: boolean;

     // Limits (cached from tier)
     limits: {
       concurrentUsers: number;
       storage: number; // bytes
       botAIMessages: number;
       botAICustom: number;
     };

     // Usage (reset monthly)
     usage: {
       botAIMessagesUsed: number;
       storageUsed: number;
     };

     // Add-ons purchased
     addons: string[]; // ['housing-system', 'key-access', ...]

     // Metadata
     createdAt: Date;
     updatedAt: Date;
   }
   ```

3. **Stripe Webhooks**
   ```typescript
   // Handle Stripe events
   POST /api/webhooks/stripe

   Events to handle:
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_succeeded
   - invoice.payment_failed
   ```

4. **Middleware: Check Subscription**
   ```typescript
   // Middleware to check active subscription
   async function requireSubscription(req, res, next) {
     const userId = req.user.id;

     const sub = await Subscription.findOne({
       userId,
       status: 'active'
     });

     if (!sub) {
       return res.status(402).json({
         result: false,
         error: 'Active subscription required',
         code: 'SUBSCRIPTION_REQUIRED'
       });
     }

     req.subscription = sub;
     next();
   }
   ```

**Deliverables**:
- ✅ Stripe integration working
- ✅ Subscription creation flow
- ✅ Webhook handling
- ✅ Subscription middleware

**Testing**:
- Create test subscription (Stripe test mode)
- Cancel subscription
- Update subscription (upgrade/downgrade)
- Handle failed payment

---

### 1.2 Feature Flags System

**Obiettivo**: Enable/disable features basate su tier e add-ons

**Tasks**:

1. **Feature Flag Config**
   ```typescript
   // Definisci features per tier
   const TIER_FEATURES = {
     starter: {
       concurrentUsers: 20,
       storage: 5 * 1024 * 1024 * 1024, // 5GB
       botAI: false,
       botAIMessages: 0,
       botAICustom: 0,
       analytics: 'basic',
       whiteLabel: false,
       apiAccess: false,
     },
     pro: {
       concurrentUsers: 50,
       storage: 25 * 1024 * 1024 * 1024, // 25GB
       botAI: true,
       botAIMessages: 2000,
       botAICustom: 10,
       analytics: 'dashboard',
       whiteLabel: 'partial',
       apiAccess: false,
     },
     enterprise: {
       concurrentUsers: 150,
       storage: 100 * 1024 * 1024 * 1024, // 100GB
       botAI: true,
       botAIMessages: 8000,
       botAICustom: Infinity,
       analytics: 'advanced',
       whiteLabel: 'full',
       apiAccess: true,
     },
     custom: {
       concurrentUsers: 300,
       storage: 500 * 1024 * 1024 * 1024, // 500GB
       botAI: true,
       botAIMessages: 20000,
       botAICustom: Infinity,
       analytics: 'advanced',
       whiteLabel: 'full',
       apiAccess: true,
     },
   };

   // Add-ons that can be purchased
   const ADDON_FEATURES = {
     'housing-system': {
       rentalSystem: true,
       evictionSystem: true,
       landlordDashboard: true,
     },
     'key-access': {
       physicalKeys: true,
       lockpicking: true,
       accessLogs: true,
     },
     'smart-permissions': {
       ruleBasedAccess: true,
       temporaryPasses: true,
     },
     'dynamic-environments': {
       locationStates: true,
       weatherSystem: true,
       spawnSystem: true,
     },
     'location-economy': {
       businessSimulation: true,
       reputationSystem: true,
       staffManagement: true,
     },
     'multi-room': {
       roomHierarchy: true,
       roomNavigation: true,
     },
     'custom-scripting': {
       scriptEditor: true,
       eventHooks: true,
       externalAPI: false, // Requires explicit enable
     },
   };
   ```

2. **Feature Check Utility**
   ```typescript
   // Check if user has feature
   function hasFeature(
     subscription: Subscription,
     feature: string
   ): boolean {
     // Check tier features
     const tierFeatures = TIER_FEATURES[subscription.tier];
     if (tierFeatures[feature]) return true;

     // Check add-on features
     for (const addon of subscription.addons) {
       const addonFeatures = ADDON_FEATURES[addon];
       if (addonFeatures && addonFeatures[feature]) {
         return true;
       }
     }

     return false;
   }

   // Get feature limit
   function getFeatureLimit(
     subscription: Subscription,
     feature: string
   ): number {
     const tierFeatures = TIER_FEATURES[subscription.tier];
     return tierFeatures[feature] || 0;
   }
   ```

3. **API Middleware**
   ```typescript
   // Require specific feature
   function requireFeature(feature: string) {
     return async (req, res, next) => {
       const sub = req.subscription;

       if (!hasFeature(sub, feature)) {
         return res.status(403).json({
           result: false,
           error: `Feature "${feature}" not available in your plan`,
           code: 'FEATURE_NOT_AVAILABLE',
           upgradeUrl: '/pricing'
         });
       }

       next();
     };
   }

   // Usage:
   router.post('/bots/generate',
     requireSubscription,
     requireFeature('botAI'),
     generateBot
   );
   ```

4. **Frontend Feature Flags**
   ```typescript
   // React hook for feature flags
   function useFeature(feature: string): boolean {
     const { subscription } = useAuth();
     return hasFeature(subscription, feature);
   }

   // Usage in components:
   function LocationSettings() {
     const hasRental = useFeature('rentalSystem');

     return (
       <div>
         {hasRental ? (
           <RentalSettings />
         ) : (
           <UpgradePrompt addon="housing-system" />
         )}
       </div>
     );
   }
   ```

**Deliverables**:
- ✅ Feature flag config defined
- ✅ hasFeature() utility working
- ✅ API middleware implemented
- ✅ Frontend hook working

---

### 1.3 Concurrent Users Tracking

**Obiettivo**: Enforce tier limits on concurrent online users

**Tasks**:

1. **Redis Tracking**
   ```typescript
   // Track online users in Redis
   const ONLINE_KEY = 'server:{serverId}:online';
   const EXPIRE = 300; // 5 minutes

   // User goes online
   async function userOnline(serverId: string, userId: string) {
     await redis.sadd(ONLINE_KEY, userId);
     await redis.expire(userId, EXPIRE);
   }

   // User goes offline
   async function userOffline(serverId: string, userId: string) {
     await redis.srem(ONLINE_KEY, userId);
   }

   // Get online count
   async function getOnlineCount(serverId: string): Promise<number> {
     return await redis.scard(ONLINE_KEY);
   }

   // Heartbeat (every 60s)
   async function userHeartbeat(serverId: string, userId: string) {
     await redis.expire(userId, EXPIRE);
   }
   ```

2. **WebSocket Integration**
   ```typescript
   // On WebSocket connect
   io.on('connection', async (socket) => {
     const userId = socket.user.id;
     const serverId = socket.user.serverId;
     const sub = await getSubscription(serverId);

     // Check limit
     const online = await getOnlineCount(serverId);
     const limit = getFeatureLimit(sub, 'concurrentUsers');

     if (online >= limit) {
       socket.emit('error', {
         code: 'CONCURRENT_LIMIT_REACHED',
         message: `Your plan allows ${limit} concurrent users. Upgrade for more.`,
         upgradeUrl: '/pricing'
       });
       socket.disconnect();
       return;
     }

     // Add to online set
     await userOnline(serverId, userId);

     // Heartbeat every 60s
     const heartbeat = setInterval(() => {
       userHeartbeat(serverId, userId);
     }, 60000);

     // On disconnect
     socket.on('disconnect', async () => {
       clearInterval(heartbeat);
       await userOffline(serverId, userId);
     });
   });
   ```

3. **Dashboard Widget**
   ```typescript
   // Show usage to admin
   function UsageDashboard() {
     const { subscription } = useAuth();
     const [online, setOnline] = useState(0);

     useEffect(() => {
       const interval = setInterval(async () => {
         const count = await fetch('/api/usage/online').then(r => r.json());
         setOnline(count);
       }, 10000); // Update every 10s

       return () => clearInterval(interval);
     }, []);

     const limit = subscription.limits.concurrentUsers;
     const percentage = (online / limit) * 100;

     return (
       <Widget>
         <h3>Online Users</h3>
         <ProgressBar value={percentage} />
         <p>{online} / {limit} online</p>
         {percentage > 80 && (
           <Alert>Approaching limit! Consider upgrading.</Alert>
         )}
       </Widget>
     );
   }
   ```

**Deliverables**:
- ✅ Redis tracking implemented
- ✅ WebSocket limit enforcement
- ✅ Dashboard showing usage

---

### 1.4 Bot AI Rate Limiting

**Obiettivo**: Track e limit Bot AI message usage per tier

**Tasks**:

1. **Usage Tracking**
   ```typescript
   // Increment bot AI usage
   async function incrementBotAIUsage(serverId: string) {
     const sub = await Subscription.findOne({ serverId });

     sub.usage.botAIMessagesUsed += 1;
     await sub.save();

     // Check if exceeded
     const limit = sub.limits.botAIMessages;
     if (sub.usage.botAIMessagesUsed >= limit) {
       // Disable bot AI until reset
       await disableBotAI(serverId);

       // Notify admin
       await sendEmail(sub.userId, {
         subject: 'Bot AI quota exceeded',
         body: 'Your Bot AI monthly quota has been exceeded. Upgrade or wait for monthly reset.'
       });
     }
   }

   // Reset monthly (cron job)
   async function resetMonthlyUsage() {
     await Subscription.updateMany({}, {
       $set: { 'usage.botAIMessagesUsed': 0 }
     });
   }
   ```

2. **Bot AI Endpoint Protection**
   ```typescript
   // Middleware: Check Bot AI quota
   async function checkBotAIQuota(req, res, next) {
     const sub = req.subscription;

     // Check if Bot AI enabled in tier
     if (!hasFeature(sub, 'botAI')) {
       return res.status(403).json({
         result: false,
         error: 'Bot AI not available in your plan',
         code: 'BOT_AI_NOT_AVAILABLE'
       });
     }

     // Check quota
     const used = sub.usage.botAIMessagesUsed;
     const limit = sub.limits.botAIMessages;

     if (used >= limit) {
       return res.status(429).json({
         result: false,
         error: `Bot AI quota exceeded (${used}/${limit}). Upgrade or wait for monthly reset.`,
         code: 'BOT_AI_QUOTA_EXCEEDED',
         resetDate: getNextMonthStart()
       });
     }

     next();
   }

   // Apply to bot endpoints
   router.post('/bots/generate',
     requireSubscription,
     checkBotAIQuota,
     async (req, res) => {
       // Generate bot...
       await incrementBotAIUsage(req.subscription.serverId);
       // ...
     }
   );
   ```

3. **Usage Dashboard**
   ```typescript
   function BotAIUsageWidget() {
     const { subscription } = useAuth();
     const used = subscription.usage.botAIMessagesUsed;
     const limit = subscription.limits.botAIMessages;
     const percentage = (used / limit) * 100;

     return (
       <Widget>
         <h3>Bot AI Messages</h3>
         <ProgressBar value={percentage} />
         <p>{used} / {limit} used this month</p>
         <p>Resets: {formatDate(getNextMonthStart())}</p>

         {percentage > 80 && (
           <Alert variant="warning">
             Running low! Consider <Link to="/pricing">upgrading</Link>.
           </Alert>
         )}

         {percentage >= 100 && (
           <Alert variant="error">
             Quota exceeded. Bot AI disabled until {formatDate(getNextMonthStart())}.
             <Button href="/addons">Purchase extra messages</Button>
           </Alert>
         )}
       </Widget>
     );
   }
   ```

**Deliverables**:
- ✅ Bot AI usage tracking
- ✅ Quota enforcement
- ✅ Monthly reset cron
- ✅ Usage dashboard

---

## Phase 2: Add-ons (Month 3-6)

### 2.1 Add-ons Purchase System

**Obiettivo**: One-time purchase di add-ons con Stripe

**Tasks**:

1. **Stripe Products for Add-ons**
   - Create one-time products in Stripe:
     - Housing System (€49)
     - Key & Access (€29)
     - Smart Permissions (€19)
     - Dynamic Environments (€39)
     - Location Economy (€59)
     - Multi-Room (€29)
     - Custom Scripting (€99)

   - Create bundles:
     - Landlord Bundle (€99)
     - Business Owner Bundle (€129)
     - Master's Complete Pack (€199)

2. **Purchase Flow**
   ```typescript
   // API: Purchase add-on
   POST /api/addons/purchase
   Body: {
     addonId: 'housing-system'
   }

   // Handler
   async function purchaseAddon(req, res) {
     const { addonId } = req.body;
     const sub = req.subscription;

     // Check if already owned
     if (sub.addons.includes(addonId)) {
       return res.status(400).json({
         result: false,
         error: 'Add-on already purchased'
       });
     }

     // Create Stripe checkout session
     const session = await stripe.checkout.sessions.create({
       customer: sub.stripeCustomerId,
       mode: 'payment',
       line_items: [{
         price: ADDON_PRICES[addonId],
         quantity: 1
       }],
       success_url: `${BASE_URL}/addons/success?addon=${addonId}`,
       cancel_url: `${BASE_URL}/addons`,
       metadata: {
         userId: req.user.id,
         addonId
       }
     });

     res.json({
       result: true,
       data: {
         checkoutUrl: session.url
       }
     });
   }
   ```

3. **Webhook: Add-on Purchased**
   ```typescript
   // Handle Stripe webhook
   async function handleCheckoutComplete(event) {
     const session = event.data.object;
     const { userId, addonId } = session.metadata;

     // Add add-on to subscription
     await Subscription.updateOne(
       { userId },
       { $addToSet: { addons: addonId } }
     );

     // Send confirmation email
     await sendEmail(userId, {
       subject: `Add-on purchased: ${addonId}`,
       body: 'Your add-on is now active!'
     });

     // Log purchase
     await Purchase.create({
       userId,
       type: 'addon',
       addonId,
       amount: session.amount_total,
       currency: 'eur',
       stripeSessionId: session.id
     });
   }
   ```

4. **Add-ons Marketplace UI**
   ```typescript
   function AddonsPage() {
     const { subscription } = useAuth();
     const owned = subscription.addons;

     return (
       <div>
         <h1>Add-ons</h1>

         <Grid>
           {ADDONS.map(addon => (
             <AddonCard key={addon.id} addon={addon}>
               {owned.includes(addon.id) ? (
                 <Badge>Owned ✓</Badge>
               ) : (
                 <Button onClick={() => purchaseAddon(addon.id)}>
                   Purchase €{addon.price}
                 </Button>
               )}
             </AddonCard>
           ))}
         </Grid>

         <h2>Bundles</h2>
         <BundleCards bundles={BUNDLES} owned={owned} />
       </div>
     );
   }
   ```

**Deliverables**:
- ✅ Add-on purchase flow
- ✅ Stripe checkout integration
- ✅ Webhook handling
- ✅ Marketplace UI

---

### 2.2 License Key System (for Self-Hosted)

**Obiettivo**: Self-hosted users can purchase add-ons with license keys

**Tasks**:

1. **License Key Generation**
   ```typescript
   // Generate license key after purchase
   async function generateLicenseKey(
     userId: string,
     addonId: string
   ): Promise<string> {
     const payload = {
       userId,
       addonId,
       issuedAt: Date.now(),
     };

     // Sign with secret
     const signature = crypto
       .createHmac('sha256', process.env.LICENSE_SECRET)
       .update(JSON.stringify(payload))
       .digest('hex');

     const key = Buffer.from(
       JSON.stringify({ ...payload, signature })
     ).toString('base64');

     return key;
   }
   ```

2. **License Key Validation API**
   ```typescript
   // Self-hosted instance calls this to validate key
   POST /api/addons/validate-license
   Body: {
     licenseKey: '...',
     addonId: 'housing-system',
     instanceId: 'uuid-of-self-hosted-instance'
   }

   // Handler
   async function validateLicense(req, res) {
     const { licenseKey, addonId, instanceId } = req.body;

     try {
       const decoded = JSON.parse(
         Buffer.from(licenseKey, 'base64').toString()
       );

       // Verify signature
       const payload = { ...decoded };
       delete payload.signature;

       const expectedSig = crypto
         .createHmac('sha256', process.env.LICENSE_SECRET)
         .update(JSON.stringify(payload))
         .digest('hex');

       if (decoded.signature !== expectedSig) {
         return res.json({ valid: false, error: 'Invalid signature' });
       }

       // Check addon matches
       if (decoded.addonId !== addonId) {
         return res.json({ valid: false, error: 'Wrong add-on' });
       }

       // Log activation
       await LicenseActivation.create({
         userId: decoded.userId,
         addonId,
         instanceId,
         activatedAt: new Date()
       });

       res.json({ valid: true });
     } catch (err) {
       res.json({ valid: false, error: 'Invalid key' });
     }
   }
   ```

3. **Self-Hosted .env Config**
   ```bash
   # .env in self-hosted instance

   # Add-on license keys
   ADDON_HOUSING_SYSTEM_KEY=eyJ1c2VySWQiOi...
   ADDON_KEY_ACCESS_KEY=eyJ1c2VySWQiOi...

   # Validation endpoint
   LICENSE_VALIDATION_URL=https://tenpennynovels.com/api/addons/validate-license
   ```

4. **Self-Hosted Feature Check**
   ```typescript
   // On self-hosted startup, validate licenses
   async function validateSelfHostedLicenses() {
     const addons = [];

     for (const [addon, key] of Object.entries(process.env)) {
       if (addon.startsWith('ADDON_') && addon.endsWith('_KEY')) {
         const addonId = addon
           .replace('ADDON_', '')
           .replace('_KEY', '')
           .toLowerCase()
           .replace('_', '-');

         const response = await fetch(
           process.env.LICENSE_VALIDATION_URL,
           {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               licenseKey: key,
               addonId,
               instanceId: process.env.INSTANCE_ID
             })
           }
         );

         const result = await response.json();

         if (result.valid) {
           addons.push(addonId);
           console.log(`✅ Add-on enabled: ${addonId}`);
         } else {
           console.error(`❌ Invalid license for ${addonId}: ${result.error}`);
         }
       }
     }

     // Store validated add-ons
     global.ENABLED_ADDONS = addons;
   }
   ```

**Deliverables**:
- ✅ License key generation
- ✅ Validation API
- ✅ Self-hosted integration
- ✅ Documentation for self-hosters

---

## Phase 3: Advanced Features (Month 7-12)

### 3.1 Usage Analytics Dashboard

**Obiettivo**: Show users their usage and suggest upgrades

**Components**:

1. **Usage API**
   ```typescript
   GET /api/usage/overview

   Response: {
     subscription: {
       tier: 'pro',
       limits: { ... },
       usage: { ... }
     },
     recommendations: [
       {
         type: 'upgrade',
         reason: 'Concurrent users often near limit',
         suggestedTier: 'enterprise',
         savings: 'Avoid disconnections'
       }
     ]
   }
   ```

2. **Dashboard UI**
   ```typescript
   function UsageDashboard() {
     return (
       <div>
         <h1>Usage & Billing</h1>

         <Grid>
           <UsageWidget
             title="Concurrent Users"
             used={online}
             limit={limits.concurrentUsers}
             unit="users"
           />

           <UsageWidget
             title="Bot AI Messages"
             used={usage.botAIMessagesUsed}
             limit={limits.botAIMessages}
             unit="messages"
             resetDate={nextMonthStart}
           />

           <UsageWidget
             title="Storage"
             used={usage.storageUsed}
             limit={limits.storage}
             unit="GB"
           />
         </Grid>

         <RecommendationsPanel />
       </div>
     );
   }
   ```

---

### 3.2 Upgrade/Downgrade Flow

**Obiettivo**: Seamless tier changes

1. **Upgrade (Immediate)**
   ```typescript
   POST /api/subscription/upgrade
   Body: { newTier: 'enterprise' }

   // Handler
   async function upgradeSubscription(req, res) {
     const { newTier } = req.body;
     const sub = req.subscription;

     // Calculate proration
     const proration = await stripe.subscriptions.update(
       sub.stripeSubscriptionId,
       {
         items: [{
           id: sub.stripeItemId,
           price: TIER_PRICES[newTier]
         }],
         proration_behavior: 'always_invoice'
       }
     );

     // Update local DB
     sub.tier = newTier;
     sub.limits = TIER_FEATURES[newTier];
     await sub.save();

     res.json({
       result: true,
       message: 'Upgraded successfully',
       proratedAmount: proration.proration_amount
     });
   }
   ```

2. **Downgrade (End of Period)**
   ```typescript
   POST /api/subscription/downgrade
   Body: { newTier: 'starter' }

   // Schedule downgrade for end of billing period
   async function downgradeSubscription(req, res) {
     const { newTier } = req.body;
     const sub = req.subscription;

     // Schedule update at period end
     await stripe.subscriptions.update(
       sub.stripeSubscriptionId,
       {
         items: [{
           id: sub.stripeItemId,
           price: TIER_PRICES[newTier]
         }],
         proration_behavior: 'none',
         billing_cycle_anchor: 'unchanged'
       }
     );

     sub.scheduledTier = newTier;
     sub.scheduledTierDate = sub.currentPeriodEnd;
     await sub.save();

     res.json({
       result: true,
       message: `Downgrade scheduled for ${sub.currentPeriodEnd}`,
       effectiveDate: sub.currentPeriodEnd
     });
   }
   ```

---

### 3.3 Trial System

**Obiettivo**: 14-day free trial for PRO/ENTERPRISE

1. **Start Trial**
   ```typescript
   POST /api/subscription/start-trial
   Body: { tier: 'pro' }

   // Handler
   async function startTrial(req, res) {
     const { tier } = req.body;
     const userId = req.user.id;

     // Check if already had trial
     const existingTrial = await Subscription.findOne({
       userId,
       hadTrial: true
     });

     if (existingTrial) {
       return res.status(400).json({
         result: false,
         error: 'Trial already used'
       });
     }

     // Create trial subscription
     const trial = await stripe.subscriptions.create({
       customer: getStripeCustomerId(userId),
       items: [{ price: TIER_PRICES[tier] }],
       trial_period_days: 14
     });

     await Subscription.create({
       userId,
       tier,
       status: 'trialing',
       stripeSubscriptionId: trial.id,
       hadTrial: true,
       currentPeriodEnd: new Date(trial.trial_end * 1000),
       limits: TIER_FEATURES[tier]
     });

     res.json({
       result: true,
       message: 'Trial started',
       trialEnd: trial.trial_end
     });
   }
   ```

2. **Trial Expiry Handling**
   ```typescript
   // Webhook: trial_will_end (3 days before)
   async function handleTrialWillEnd(event) {
     const sub = event.data.object;

     await sendEmail(getUserEmail(sub.customer), {
       subject: 'Trial ending in 3 days',
       body: 'Add payment method to continue...'
     });
   }

   // Webhook: customer.subscription.updated (trial ended)
   async function handleTrialEnded(event) {
     const sub = event.data.object;

     if (sub.status === 'active') {
       // Converted! Send thank you
     } else {
       // Didn't convert, downgrade to free (self-hosted only)
     }
   }
   ```

---

## Phase 4: Polish & Scale (Month 13+)

### 4.1 Performance Optimization

- Cache subscription data (Redis, 5min TTL)
- Batch usage updates (queue in Redis, flush every 10s)
- Optimize database queries (indexes on userId, tier, status)

### 4.2 Monitoring & Alerts

- Datadog/Sentry for error tracking
- Stripe Dashboard for revenue monitoring
- Alerts for:
  - Failed payments
  - Churn spike
  - Usage anomalies

### 4.3 Customer Success

- Automated onboarding emails
- Usage reports (monthly)
- Upgrade prompts (when approaching limits)
- Win-back campaigns (for churned users)

---

## Testing Strategy

### Unit Tests
- Feature flag logic
- License key validation
- Usage tracking functions

### Integration Tests
- Stripe webhook handling
- Subscription CRUD
- Upgrade/downgrade flow

### E2E Tests
- Complete purchase flow (Stripe test mode)
- Trial → paid conversion
- Add-on purchase

---

## Rollout Plan

### Beta (Month 1-2)
- Invite-only
- 10-20 beta testers
- Free for beta participants
- Collect feedback

### Soft Launch (Month 3-4)
- Public but limited marketing
- Pricing finalized
- Support processes tested

### Full Launch (Month 5+)
- Marketing push
- Press release
- Community announcement

---

## Success Metrics

### Technical KPIs
- Subscription creation success rate: >95%
- Payment failure rate: <2%
- Feature flag response time: <10ms
- Stripe webhook processing: <1s

### Business KPIs
- Trial → paid conversion: >40%
- Upgrade rate (STARTER → PRO): >20%
- Add-on attach rate: >30%
- Churn rate: <5%

---

## Risk Mitigation

### Technical Risks
- **Stripe downtime**: Queue webhooks, retry failed
- **Rate limit bugs**: Extensive testing, gradual rollout
- **License key piracy**: Online validation required

### Business Risks
- **Low conversion**: A/B test pricing
- **High churn**: Improve onboarding
- **Support overload**: Hire as needed

---

## Documentation Needed

### Developer Docs
- Subscription API reference
- Feature flags guide
- Add-on integration guide

### User Docs
- Pricing page FAQ
- Upgrade/downgrade guide
- Billing & invoices
- Add-ons marketplace guide

### Internal Docs
- Runbook for failed payments
- Customer support playbook
- Refund policy & process

---

## Conclusion

Implementation is **feasible** and **incremental**:

1. **Phase 1** (2 months): Core subscription + feature flags
2. **Phase 2** (3-4 months): Add-ons system
3. **Phase 3** (6 months): Advanced features
4. **Phase 4** (ongoing): Polish & scale

**Estimated development time**: 6-8 months (solo) or 3-4 months (2 developers)

**Complexity**: Medium (Stripe integration is well-documented, feature flags are straightforward)

**Risk**: Low (can validate each phase before proceeding)
