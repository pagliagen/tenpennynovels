import mongoose, { Schema, Document } from 'mongoose';

/**
 * Plutchik Wheel of Emotions — 8 emozioni primarie con intensità 0-1.
 * Il livello di intensità determina la label:
 *   < 0.4 = bassa (serenità, accettazione, apprensione...)
 *   0.4-0.7 = media (gioia, fiducia, paura...)
 *   > 0.7 = alta (estasi, ammirazione, terrore...)
 */
export interface IPlutchikEmotions {
  gioia: number;          // 0-1 | serenità → gioia → estasi
  fiducia: number;        // 0-1 | accettazione → fiducia → ammirazione
  paura: number;          // 0-1 | apprensione → paura → terrore
  sorpresa: number;       // 0-1 | distrazione → sorpresa → stupore
  tristezza: number;      // 0-1 | pensierosità → tristezza → angoscia
  disgusto: number;       // 0-1 | noia → disgusto → odio
  rabbia: number;         // 0-1 | irritazione → rabbia → collera
  anticipazione: number;  // 0-1 | interesse → anticipazione → vigilanza
}

export interface IEmotionState {
  axes: IPlutchikEmotions;
  expressedAxes?: IPlutchikEmotions;  // emozioni mostrate dopo regolazione (felt → expressed)
  trigger: string;                     // cosa ha causato questo stato emotivo
  updatedAt: Date;
  suppressionBurden?: number;          // 0-1, costo cumulativo della soppressione emotiva
}

export const PLUTCHIK_AXES = ['gioia', 'fiducia', 'paura', 'sorpresa', 'tristezza', 'disgusto', 'rabbia', 'anticipazione'] as const;

export const PLUTCHIK_LABELS: Record<string, [string, string, string]> = {
  gioia:          ['serenità', 'gioia', 'estasi'],
  fiducia:        ['accettazione', 'fiducia', 'ammirazione'],
  paura:          ['apprensione', 'paura', 'terrore'],
  sorpresa:       ['distrazione', 'sorpresa', 'stupore'],
  tristezza:      ['pensierosità', 'tristezza', 'angoscia'],
  disgusto:       ['noia', 'disgusto', 'odio'],
  rabbia:         ['irritazione', 'rabbia', 'collera'],
  anticipazione:  ['interesse', 'anticipazione', 'vigilanza'],
};

// ── Decay differenziato per asse (half-life in ms) ──────────────────
export const AXIS_HALF_LIFE_MS: Record<typeof PLUTCHIK_AXES[number], number> = {
  sorpresa:       15 * 60 * 1000,   // 15 min — più fugace
  gioia:          20 * 60 * 1000,   // 20 min — fugace
  anticipazione:  45 * 60 * 1000,   // 45 min — media
  fiducia:        60 * 60 * 1000,   // 60 min — lenta a svanire
  paura:          90 * 60 * 1000,   // 90 min — persiste (funzione protettiva)
  disgusto:      150 * 60 * 1000,   // 2.5h — persistente
  tristezza:     180 * 60 * 1000,   // 3h — pesante
  rabbia:        240 * 60 * 1000,   // 4h — decay più lento
};

// ── Modificatori emotivi basati sulla personalità ───────────────────

export interface IEmotionModifier {
  axes: ReadonlyArray<typeof PLUTCHIK_AXES[number]>;
  decayMultiplier?: number;  // moltiplicato sull'half-life (>1 = decay più lento)
  capOverride?: number;      // intensità massima per gli assi indicati
  amplifier?: number;        // moltiplicato sui valori in ingresso (>1 = emozioni più forti)
}

export interface IPersonalityProfile {
  globalCap: number;
  globalAmplifier: number;
  emotionalControl: number;  // 0-1, capacità di regolazione emotiva (freddo=alto, passionale=basso)
  axisModifiers: Map<typeof PLUTCHIK_AXES[number], {
    decayMultiplier: number;
    cap: number;       // cap di ESPRESSIONE (non di sentimento)
    amplifier: number; // amplificatore di ESPRESSIONE (non di sentimento)
  }>;
}

export const TRAIT_EMOTION_RULES: Array<{ keywords: string[]; modifier: IEmotionModifier }> = [
  // Temperamento freddo/riservato
  {
    keywords: ['freddo', 'riservato', 'riservata', 'distaccato', 'distaccata', 'stoico', 'stoica', 'impassibile', 'controllato', 'controllata'],
    modifier: { axes: [...PLUTCHIK_AXES], capOverride: 0.4, amplifier: 0.6 },
  },
  // Temperamento passionale/emotivo
  {
    keywords: ['passionale', 'emotivo', 'emotiva', 'impulsivo', 'impulsiva', 'ardente', 'focoso', 'focosa', 'esuberante'],
    modifier: { axes: [...PLUTCHIK_AXES], amplifier: 1.3 },
  },
  // Rancoroso/vendicativo
  {
    keywords: ['rancoroso', 'rancorosa', 'vendicativo', 'vendicativa'],
    modifier: { axes: ['rabbia', 'disgusto'], decayMultiplier: 3.0 },
  },
  // Melanconico
  {
    keywords: ['melanconico', 'melanconica', 'malinconico', 'malinconica', 'cupo', 'cupa'],
    modifier: { axes: ['tristezza'], decayMultiplier: 2.0, amplifier: 1.3 },
  },
  // Ansioso/timoroso
  {
    keywords: ['ansioso', 'ansiosa', 'nervoso', 'nervosa', 'timoroso', 'timorosa', 'pauroso', 'paurosa'],
    modifier: { axes: ['paura', 'anticipazione'], decayMultiplier: 1.5, amplifier: 1.2 },
  },
  // Ottimista/allegro
  {
    keywords: ['ottimista', 'allegro', 'allegra', 'solare', 'gioviale', 'gioioso', 'gioiosa'],
    modifier: { axes: ['gioia'], decayMultiplier: 1.5, amplifier: 1.2 },
  },
  // Fiducioso/leale
  {
    keywords: ['leale', 'fedele', 'fiducioso', 'fiduciosa', 'devoto', 'devota'],
    modifier: { axes: ['fiducia'], decayMultiplier: 2.0, amplifier: 1.2 },
  },
  // Diffidente/cinico
  {
    keywords: ['diffidente', 'sospettoso', 'sospettosa', 'cinico', 'cinica', 'paranoico', 'paranoica'],
    modifier: { axes: ['fiducia'], capOverride: 0.3, amplifier: 0.5 },
  },
  // Irascibile
  {
    keywords: ['irascibile', 'collerico', 'collerica', 'scontroso', 'scontrosa', 'burbero', 'burbera'],
    modifier: { axes: ['rabbia'], decayMultiplier: 1.5, amplifier: 1.3 },
  },
  // Curioso
  {
    keywords: ['curioso', 'curiosa', 'indagatore', 'indagatrice'],
    modifier: { axes: ['anticipazione', 'sorpresa'], amplifier: 1.2 },
  },
];

// ── Intrinsic Motivation (Needs & Goals) ──────────────────────────────
export type NeedType = 'status' | 'security' | 'belonging' | 'autonomy' | 'purpose';

export interface INeed {
  type: NeedType;
  satisfaction: number;    // 0-1, decays over time
  salience: number;        // 0-1, how important for THIS character (derived from personality)
  lastSatisfied: Date;
}

export interface IGoal {
  description: string;
  type: 'short_term' | 'long_term';
  relatedNeed: NeedType;
  progress: number;        // 0-1
  createdAt: Date;
  status: 'active' | 'achieved' | 'abandoned';
}

export interface INarrativeStyle {
  author: string;
  guidance: string;
}

export type BotStatus = 'pending' | 'active';

export interface IBot extends Document {
  name: string;
  gender?: 'male' | 'female';
  publicDescription?: string;
  personality: {
    traits: string[];
    speech_style: string;
    background: string;
    coreValues?: string[];
  };
  systemPrompt: string;
  narrativeStyle?: INarrativeStyle;
  emotionState: IEmotionState;
  currentMood: { type: string; since: Date };
  status: BotStatus;
  isActive: boolean;
  // Intrinsic motivation (Fase 4)
  needs?: INeed[];
  goals?: IGoal[];
  selfMonitoring?: number;  // 0-1, Goffman self-monitoring (Phase 5 prep)
  createdAt: Date;
  updatedAt: Date;
}

const PlutchikSchema = new Schema({
  gioia: { type: Number, default: 0, min: 0, max: 1 },
  fiducia: { type: Number, default: 0, min: 0, max: 1 },
  paura: { type: Number, default: 0, min: 0, max: 1 },
  sorpresa: { type: Number, default: 0, min: 0, max: 1 },
  tristezza: { type: Number, default: 0, min: 0, max: 1 },
  disgusto: { type: Number, default: 0, min: 0, max: 1 },
  rabbia: { type: Number, default: 0, min: 0, max: 1 },
  anticipazione: { type: Number, default: 0, min: 0, max: 1 },
}, { _id: false });

const EmotionStateSchema = new Schema({
  axes: { type: PlutchikSchema, default: () => ({}) },
  expressedAxes: { type: PlutchikSchema, default: undefined },
  trigger: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
  suppressionBurden: { type: Number, default: 0, min: 0, max: 1 },
}, { _id: false });

const NarrativeStyleSchema = new Schema<INarrativeStyle>({
  author: { type: String, required: true },
  guidance: { type: String, required: true },
}, { _id: false });

const NeedSchema = new Schema({
  type: { type: String, enum: ['status', 'security', 'belonging', 'autonomy', 'purpose'], required: true },
  satisfaction: { type: Number, default: 0.5, min: 0, max: 1 },
  salience: { type: Number, default: 0.5, min: 0, max: 1 },
  lastSatisfied: { type: Date, default: Date.now },
}, { _id: false });

const GoalSchema = new Schema({
  description: { type: String, required: true },
  type: { type: String, enum: ['short_term', 'long_term'], default: 'short_term' },
  relatedNeed: { type: String, enum: ['status', 'security', 'belonging', 'autonomy', 'purpose'] },
  progress: { type: Number, default: 0, min: 0, max: 1 },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'achieved', 'abandoned'], default: 'active' },
}, { _id: false });

const BotSchema = new Schema<IBot>({
  name: { type: String, required: true },
  gender: { type: String, enum: ['male', 'female'] },
  publicDescription: { type: String },
  personality: {
    traits: [String],
    speech_style: { type: String, default: '' },
    background: { type: String, default: '' },
    coreValues: [String],
  },
  systemPrompt: { type: String, required: true },
  narrativeStyle: { type: NarrativeStyleSchema, default: undefined },
  emotionState: { type: Schema.Types.Mixed, default: () => ({ axes: {}, trigger: '', updatedAt: new Date() }) },
  currentMood: {
    type: { type: String, default: 'neutro' },
    since: { type: Date, default: Date.now },
  },
  status: { type: String, enum: ['pending', 'active'], default: 'pending' },
  isActive: { type: Boolean, default: true },
  needs: { type: [NeedSchema], default: undefined },
  goals: { type: [GoalSchema], default: undefined },
  selfMonitoring: { type: Number, default: 0.5, min: 0, max: 1 },
}, { timestamps: true });

export const Bot = mongoose.model<IBot>('Bot', BotSchema);
