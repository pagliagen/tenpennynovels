import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { ManagementLayout } from '@/components/ManagementLayout';
import { AuthContext } from '@/lib/auth';
import { useNotification } from '@/contexts/NotificationContext';
import styles from '@/styles/pages/Management.module.scss';
import {
  validateIntelligenceBonusFormula,
  calculateIntelligenceBonus,
  validateTotalPointsFormula,
  calculateTotalPoints,
  validateDerivedFormula,
  calculateDerivedStat,
  type CharacterStats
} from '@/lib/intelligenceBonusFormula';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:8000';

// ==================== TYPES ====================

interface PageProps {
  authContext: AuthContext;
}

interface CharacterCreationConfig {
  _meta: {
    version: string;
    description: string;
    lastUpdated: string;
    lastModifiedBy: string;
  };
  stats: {
    basePoints: number;
    totalPoints: number;
    maxStatsAbove80: number;
    creationCap: number;
    gameplayCap: number;
  };
  skills: {
    totalPointsFormula: string;
    intelligenceBonusFormula: string;
    creationCap: number;
    creationCapWithOccupation: number;
    gameplayCap: number;
  };
  occupation: {
    requiredSkillMinimum: number;
    bonusSkillPoints: number;
    requiredSkillCount: { min: number; max: number };
    bonusSkillCount: { min: number; max: number };
  };
  limits: {
    age: { min: number; max: number };
    weight: { min: number; max: number };
    height: { min: number; max: number };
    backgroundFields: {
      briefHistoryMin: number;
      personalityMin: number;
      goalsMin: number;
      maxLength: number;
    };
  };
  socialClasses: Array<{
    id: string;
    name: string;
    financeSkillRange: { min: number; max: number };
    weeklyCredit: number;
    initialWealth: { minCash: number; maxCash: number };
  }>;
  formulas: {
    derived: {
      hitPoints: string;
      sanityPoints: string;
      magicPoints: string;
      luck: string;
      ideaRoll: string;
      knowledge: string;
      movementRate: string;
    };
    damageBonus: Array<{
      maxTotal: number;
      bonus: string;
      build: number;
    }>;
  };
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

type TabKey = 'stats' | 'skills' | 'occupation' | 'limits' | 'social-classes' | 'formulas';

// ==================== COMPONENT ====================

export default function CharacterCreationConfigPage({ authContext }: PageProps) {
  const { showPrompt, showToast } = useNotification();

  // State
  const [activeTab, setActiveTab] = useState<TabKey>('stats');
  const [config, setConfig] = useState<CharacterCreationConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<CharacterCreationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showJsonPreview, setShowJsonPreview] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [previewBonus, setPreviewBonus] = useState<number | null>(null);
  const [totalPointsFormulaError, setTotalPointsFormulaError] = useState<string | null>(null);
  const [totalPointsPreview, setTotalPointsPreview] = useState<number | null>(null);

  // ==================== FETCH FUNCTIONS ====================

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/system/character-creation-config`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Errore nel caricamento della configurazione');
      }

      const data = await response.json();
      if (data.success && data.data?.config) {
        setConfig(data.data.config);
        setOriginalConfig(JSON.parse(JSON.stringify(data.data.config)));
        setHasChanges(false);
      }
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const validateConfig = async (configToValidate: CharacterCreationConfig): Promise<ValidationResult> => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/system/character-creation-config/validate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: configToValidate })
      });

      const data = await response.json();
      if (data.success && data.data) {
        return data.data;
      }
      // Include error details from backend if available
      const errorMsg = data.message || data.error || 'Errore nella validazione - controlla i campi evidenziati in rosso';
      return { isValid: false, errors: [errorMsg], warnings: [] };
    } catch (error: any) {
      return { isValid: false, errors: [error.message], warnings: [] };
    }
  };

  const saveConfig = async () => {
    if (!config) return;

    // Validate first
    const validation = await validateConfig(config);
    setValidationResult(validation);

    if (!validation.isValid) {
      showToast('La configurazione contiene errori. Correggili prima di salvare.', 'error');
      return;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      const proceed = await showPrompt(
        'Avvisi di Validazione',
        `La configurazione ha ${validation.warnings.length} avvisi:\n\n${validation.warnings.join('\n')}\n\nVuoi procedere comunque?`
      );
      if (!proceed) return;
    }

    // Ask for reason
    const reason = await showPrompt(
      'Motivo Modifica',
      'Inserisci il motivo della modifica (obbligatorio):'
    );

    if (!reason || reason.trim().length === 0) {
      showToast('Il motivo della modifica è obbligatorio', 'error');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/admin/system/character-creation-config`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, reason: reason.trim() })
      });

      const data = await response.json();
      if (data.success) {
        showToast('Configurazione salvata con successo', 'success');
        await fetchConfig(); // Reload to get updated metadata
      } else {
        throw new Error(data.error || 'Errore nel salvataggio');
      }
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const invalidateCache = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/system/character-creation-config/invalidate-cache`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success) {
        showToast('Cache invalidata con successo', 'success');
      }
    } catch (error: any) {
      showToast(`Errore: ${error.message}`, 'error');
    }
  };

  const resetChanges = () => {
    if (originalConfig) {
      setConfig(JSON.parse(JSON.stringify(originalConfig)));
      setHasChanges(false);
      setValidationResult(null);
    }
  };

  // ==================== HANDLERS ====================

  const updateConfig = (path: string[], value: any) => {
    if (!config) return;

    const newConfig = JSON.parse(JSON.stringify(config));
    let current: any = newConfig;

    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;

    setConfig(newConfig);
    setHasChanges(true);

    // Auto-validate
    validateConfig(newConfig).then(setValidationResult);
  };

  // ==================== EFFECTS ====================

  useEffect(() => {
    fetchConfig();
  }, []);

  // ==================== RENDER ====================

  if (loading || !config) {
    return (
      <ManagementLayout authContext={authContext}>
        <Head>
          <title>TenpennyNovels Management - Configurazione Creazione Personaggio</title>
        </Head>
        <div className={styles.pageContainer}>
          <h1>Configurazione Creazione Personaggio</h1>
          <p>Caricamento...</p>
        </div>
      </ManagementLayout>
    );
  }

  const tabs = [
    { key: 'stats' as TabKey, label: 'Caratteristiche' },
    { key: 'skills' as TabKey, label: 'Abilità' },
    { key: 'occupation' as TabKey, label: 'Occupazioni' },
    { key: 'limits' as TabKey, label: 'Limiti' },
    { key: 'social-classes' as TabKey, label: 'Classi Sociali' },
    { key: 'formulas' as TabKey, label: 'Formule' }
  ];

  return (
    <ManagementLayout authContext={authContext}>
      <Head>
        <title>TenpennyNovels Management - Configurazione Creazione Personaggio</title>
      </Head>

      <div className={styles.pageContainer}>
        <div className={styles.header}>
        <div>
          <h1>Configurazione Creazione Personaggio</h1>
          <p className={styles.subtitle}>
            Gestisci i parametri del wizard di creazione personaggio
          </p>
          <div className={styles.metadata}>
            <span><strong>Versione:</strong> {config._meta.version}</span>
            <span><strong>Ultimo aggiornamento:</strong> {new Date(config._meta.lastUpdated).toLocaleString('it-IT')}</span>
            <span><strong>Modificato da:</strong> {config._meta.lastModifiedBy}</span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            onClick={() => setShowJsonPreview(!showJsonPreview)}
            className={styles.secondaryButton}
          >
            {showJsonPreview ? 'Nascondi' : 'Mostra'} JSON
          </button>
          <button
            onClick={invalidateCache}
            className={styles.secondaryButton}
          >
            Invalida Cache
          </button>
          <button
            onClick={resetChanges}
            className={styles.secondaryButton}
            disabled={!hasChanges}
          >
            Reset
          </button>
          <button
            onClick={saveConfig}
            className={styles.primaryButton}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Salvataggio...' : 'Salva Modifiche'}
          </button>
        </div>
      </div>

      {/* Validation Messages */}
      {validationResult && (
        <div className={styles.validationMessages}>
          {validationResult.errors.length > 0 && (
            <div className={styles.errorBox}>
              <h3>❌ Errori ({validationResult.errors.length})</h3>
              <ul>
                {validationResult.errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          {validationResult.warnings.length > 0 && (
            <div className={styles.warningBox}>
              <h3>⚠️ Avvisi ({validationResult.warnings.length})</h3>
              <ul>
                {validationResult.warnings.map((warning, idx) => (
                  <li key={idx}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {validationResult.isValid && validationResult.errors.length === 0 && (
            <div className={styles.successBox}>
              ✅ La configurazione è valida
            </div>
          )}
        </div>
      )}

      {/* JSON Preview */}
      {showJsonPreview && (
        <div className={styles.jsonPreview}>
          <h3>Preview JSON</h3>
          <pre>{JSON.stringify(config, null, 2)}</pre>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className={styles.tabsContainer}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`${styles.tab} ${activeTab === tab.key ? styles.activeTab : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'stats' && (
          <StatsTab config={config} updateConfig={updateConfig} />
        )}
        {activeTab === 'skills' && (
          <SkillsTab
            config={config}
            updateConfig={updateConfig}
            formulaError={formulaError}
            setFormulaError={setFormulaError}
            previewBonus={previewBonus}
            setPreviewBonus={setPreviewBonus}
            totalPointsFormulaError={totalPointsFormulaError}
            setTotalPointsFormulaError={setTotalPointsFormulaError}
            totalPointsPreview={totalPointsPreview}
            setTotalPointsPreview={setTotalPointsPreview}
          />
        )}
        {activeTab === 'occupation' && (
          <OccupationTab config={config} updateConfig={updateConfig} />
        )}
        {activeTab === 'limits' && (
          <LimitsTab config={config} updateConfig={updateConfig} />
        )}
        {activeTab === 'social-classes' && (
          <SocialClassesTab config={config} updateConfig={updateConfig} />
        )}
        {activeTab === 'formulas' && (
          <FormulasTab config={config} updateConfig={updateConfig} />
        )}
      </div>
      </div>
    </ManagementLayout>
  );
}

// ==================== TAB COMPONENTS ====================

interface TabProps {
  config: CharacterCreationConfig;
  updateConfig: (path: string[], value: any) => void;
  formulaError?: string | null;
  setFormulaError?: (error: string | null) => void;
  previewBonus?: number | null;
  setPreviewBonus?: (bonus: number | null) => void;
  totalPointsFormulaError?: string | null;
  setTotalPointsFormulaError?: (error: string | null) => void;
  totalPointsPreview?: number | null;
  setTotalPointsPreview?: (points: number | null) => void;
}

const StatsTab: React.FC<TabProps> = ({ config, updateConfig }) => (
  <div className={styles.formGrid}>
    <h2>Parametri Caratteristiche</h2>
    <p className={styles.tabDescription}>
      Configura i parametri per la distribuzione delle caratteristiche nel wizard di creazione.
    </p>

    <div className={styles.formRow}>
      <label>
        Punti Base per Caratteristica
        <input
          type="number"
          min="10"
          max="30"
          value={config.stats.basePoints}
          onChange={(e) => updateConfig(['stats', 'basePoints'], parseInt(e.target.value))}
        />
        <small>Valore iniziale di ogni caratteristica (default: 20)</small>
      </label>

      <label>
        Punti Totali da Distribuire
        <input
          type="number"
          min="200"
          max="600"
          value={config.stats.totalPoints}
          onChange={(e) => updateConfig(['stats', 'totalPoints'], parseInt(e.target.value))}
        />
        <small>Punti da distribuire sopra la base (default: 400)</small>
      </label>
    </div>

    <div className={styles.formRow}>
      <label>
        Max Caratteristiche Sopra 80
        <input
          type="number"
          min="0"
          max="8"
          value={config.stats.maxStatsAbove80}
          onChange={(e) => updateConfig(['stats', 'maxStatsAbove80'], parseInt(e.target.value))}
        />
        <small>Numero massimo di caratteristiche che possono superare 80 (default: 2)</small>
      </label>
    </div>

    <div className={styles.formRow}>
      <label>
        Cap Creazione (Wizard)
        <input
          type="number"
          min="70"
          max="99"
          value={config.stats.creationCap}
          onChange={(e) => updateConfig(['stats', 'creationCap'], parseInt(e.target.value))}
        />
        <small>Limite massimo durante la creazione in bozza (default: 85)</small>
      </label>

      <label>
        Cap Gameplay (Approvato)
        <input
          type="number"
          min="70"
          max="99"
          value={config.stats.gameplayCap}
          onChange={(e) => updateConfig(['stats', 'gameplayCap'], parseInt(e.target.value))}
        />
        <small>Limite massimo durante il gioco (deve essere ≥ cap creazione, default: 99)</small>
      </label>
    </div>

    {config.stats.gameplayCap < config.stats.creationCap && (
      <div className={styles.errorBox}>
        <strong>⚠️ Errore di Validazione:</strong> Il <strong>Cap Gameplay</strong> ({config.stats.gameplayCap}) deve essere maggiore o uguale al <strong>Cap Creazione Normale</strong> ({config.stats.creationCap}).
      </div>
    )}
  </div>
);

const SkillsTab: React.FC<TabProps> = ({ config, updateConfig, formulaError, setFormulaError, previewBonus, setPreviewBonus, totalPointsFormulaError, setTotalPointsFormulaError, totalPointsPreview, setTotalPointsPreview }) => (
  <div className={styles.formGrid}>
    <h2>Parametri Abilità</h2>
    <p className={styles.tabDescription}>
      Configura i parametri per la distribuzione delle abilità e i cap durante creazione e gameplay.
    </p>

    <div className={styles.formRow}>
      <label>
        Formula Punti Base
        <input
          type="text"
          value={config.skills.totalPointsFormula || 'constant:200'}
          onChange={(e) => {
            const newFormula = e.target.value;

            // Always update the value to allow free editing
            updateConfig(['skills', 'totalPointsFormula'], newFormula);

            // Validate in real-time for user feedback
            const validation = validateTotalPointsFormula(newFormula);

            if (validation.valid) {
              setTotalPointsFormulaError?.(null);
              // Calculate preview with typical starting stats (EDU=20, INT=50, etc.)
              const preview = calculateTotalPoints(newFormula, { EDU: 20, INT: 50, STR: 50, DEX: 50, CON: 50, SIZ: 50, APP: 50, POW: 50 });
              setTotalPointsPreview?.(preview);
            } else {
              setTotalPointsFormulaError?.(validation.error || 'Formula non valida');
              setTotalPointsPreview?.(null);
            }
          }}
          style={{ fontFamily: 'monospace' }}
        />
        <small>
          Formato: "constant:200" oppure "formula:..." con caratteristiche (EDU, INT, STR, DEX, CON, SIZ, APP, POW). Usa "x" per moltiplicazione.
          <br />
          Esempi: constant:200, formula:EDUx4, formula:EDUx2+INTx2, formula:EDUx4+200
          {totalPointsPreview !== null && (
            <>
              <br />
              <strong>Preview (EDU=20, altre=50): {totalPointsPreview} punti base</strong>
            </>
          )}
        </small>
        {totalPointsFormulaError && (
          <div style={{ color: 'red', fontSize: '0.85rem', marginTop: '5px' }}>
            ⚠️ {totalPointsFormulaError}
          </div>
        )}
      </label>

      <label>
        Formula Bonus INT
        <input
          type="text"
          value={config.skills.intelligenceBonusFormula || 'INT/2'}
          onChange={(e) => {
            const newFormula = e.target.value;

            // Always update the value to allow free editing
            updateConfig(['skills', 'intelligenceBonusFormula'], newFormula);

            // Validate in real-time for user feedback
            const validation = validateIntelligenceBonusFormula(newFormula);

            if (validation.valid) {
              setFormulaError?.(null);
              // Calculate preview with INT=50
              const preview = calculateIntelligenceBonus(newFormula, 50);
              setPreviewBonus?.(preview);
            } else {
              setFormulaError?.(validation.error || 'Formula non valida');
              setPreviewBonus?.(null);
            }
          }}
          onBlur={() => {
            const currentFormula = config.skills.intelligenceBonusFormula;

            // If empty or invalid, reset to default
            if (!currentFormula || currentFormula.trim() === '') {
              updateConfig(['skills', 'intelligenceBonusFormula'], 'INT/2');
              setFormulaError?.(null);
              setPreviewBonus?.(25);
              return;
            }

            // Validate on blur
            const validation = validateIntelligenceBonusFormula(currentFormula);
            if (!validation.valid) {
              // Reset to default if invalid
              updateConfig(['skills', 'intelligenceBonusFormula'], 'INT/2');
              setFormulaError?.(null);
              setPreviewBonus?.(25);
            }
          }}
          style={{ fontFamily: 'monospace' }}
        />
        <small>
          Esempi: INT/2, INTx2, INT+10, INT-5, constant:25
          <br />
          Usa "x" per moltiplicazione. Default: INT/2
          {previewBonus !== null && (
            <>
              <br />
              <strong>Preview (INT=50): {previewBonus} punti bonus</strong>
            </>
          )}
        </small>
        {formulaError && (
          <div style={{ color: 'red', fontSize: '0.85rem', marginTop: '5px' }}>
            ⚠️ {formulaError}
          </div>
        )}
      </label>
    </div>

    <div className={styles.formRow}>
      <label>
        Cap Creazione Normale
        <input
          type="number"
          min="50"
          max="90"
          value={config.skills.creationCap}
          onChange={(e) => updateConfig(['skills', 'creationCap'], parseInt(e.target.value))}
        />
        <small>Limite per abilità senza bonus occupazione (default: 75)</small>
      </label>

      <label>
        Cap Creazione con Occupazione
        <input
          type="number"
          min="50"
          max="95"
          value={config.skills.creationCapWithOccupation}
          onChange={(e) => updateConfig(['skills', 'creationCapWithOccupation'], parseInt(e.target.value))}
        />
        <small>Limite per abilità con bonus occupazione (default: 80)</small>
      </label>
    </div>

    <div className={styles.formRow}>
      <label>
        Cap Gameplay (Approvato)
        <input
          type="number"
          min="70"
          max="99"
          value={config.skills.gameplayCap}
          onChange={(e) => updateConfig(['skills', 'gameplayCap'], parseInt(e.target.value))}
        />
        <small>Limite massimo durante il gioco (deve essere ≥ cap creazione, default: 99)</small>
      </label>
    </div>

    {(config.skills.creationCap > config.skills.creationCapWithOccupation ||
      config.skills.creationCapWithOccupation > config.skills.gameplayCap) && (
      <div className={styles.errorBox}>
        <strong>⚠️ Errore di Validazione:</strong> I cap devono rispettare l'ordine: <strong>Cap Creazione Normale</strong> ({config.skills.creationCap}) ≤ <strong>Cap Creazione con Occupazione</strong> ({config.skills.creationCapWithOccupation}) ≤ <strong>Cap Gameplay</strong> ({config.skills.gameplayCap}).
      </div>
    )}
  </div>
);

const OccupationTab: React.FC<TabProps> = ({ config, updateConfig }) => (
  <div className={styles.formGrid}>
    <h2>Parametri Occupazioni</h2>
    <p className={styles.tabDescription}>
      Configura i parametri per i requisiti e bonus delle occupazioni.
    </p>

    <div className={styles.formRow}>
      <label>
        Minimo Skill Richiesta
        <input
          type="number"
          min="20"
          max="60"
          value={config.occupation.requiredSkillMinimum}
          onChange={(e) => updateConfig(['occupation', 'requiredSkillMinimum'], parseInt(e.target.value))}
        />
        <small>Valore minimo per le skill richieste dall'occupazione (default: 40)</small>
      </label>

      <label>
        Punti Skill Bonus
        <input
          type="number"
          min="10"
          max="50"
          value={config.occupation.bonusSkillPoints}
          onChange={(e) => updateConfig(['occupation', 'bonusSkillPoints'], parseInt(e.target.value))}
        />
        <small>Punti bonus aggiunti alle skill dell'occupazione (default: 30)</small>
      </label>
    </div>

    <h3>Numero Skill Richieste</h3>
    <div className={styles.formRow}>
      <label>
        Min Skill Richieste
        <input
          type="number"
          min="4"
          max="8"
          value={config.occupation.requiredSkillCount.min}
          onChange={(e) => updateConfig(['occupation', 'requiredSkillCount', 'min'], parseInt(e.target.value))}
        />
        <small>Numero minimo di skill richieste (default: 6)</small>
      </label>

      <label>
        Max Skill Richieste
        <input
          type="number"
          min="4"
          max="8"
          value={config.occupation.requiredSkillCount.max}
          onChange={(e) => updateConfig(['occupation', 'requiredSkillCount', 'max'], parseInt(e.target.value))}
        />
        <small>Numero massimo di skill richieste (default: 6)</small>
      </label>
    </div>

    <h3>Numero Skill Bonus</h3>
    <div className={styles.formRow}>
      <label>
        Min Skill Bonus
        <input
          type="number"
          min="1"
          max="4"
          value={config.occupation.bonusSkillCount.min}
          onChange={(e) => updateConfig(['occupation', 'bonusSkillCount', 'min'], parseInt(e.target.value))}
        />
        <small>Numero minimo di skill bonus (default: 1)</small>
      </label>

      <label>
        Max Skill Bonus
        <input
          type="number"
          min="1"
          max="4"
          value={config.occupation.bonusSkillCount.max}
          onChange={(e) => updateConfig(['occupation', 'bonusSkillCount', 'max'], parseInt(e.target.value))}
        />
        <small>Numero massimo di skill bonus (default: 1)</small>
      </label>
    </div>
  </div>
);

const LimitsTab: React.FC<TabProps> = ({ config, updateConfig }) => (
  <div className={styles.formGrid}>
    <h2>Limiti Personaggio</h2>
    <p className={styles.tabDescription}>
      Configura i limiti per età, peso, altezza e campi di background.
    </p>

    <h3>Età</h3>
    <div className={styles.formRow}>
      <label>
        Età Minima
        <input
          type="number"
          min="10"
          max="30"
          value={config.limits.age.min}
          onChange={(e) => updateConfig(['limits', 'age', 'min'], parseInt(e.target.value))}
        />
      </label>
      <label>
        Età Massima
        <input
          type="number"
          min="50"
          max="100"
          value={config.limits.age.max}
          onChange={(e) => updateConfig(['limits', 'age', 'max'], parseInt(e.target.value))}
        />
      </label>
    </div>

    <h3>Peso (kg)</h3>
    <div className={styles.formRow}>
      <label>
        Peso Minimo
        <input
          type="number"
          min="20"
          max="50"
          value={config.limits.weight.min}
          onChange={(e) => updateConfig(['limits', 'weight', 'min'], parseInt(e.target.value))}
        />
      </label>
      <label>
        Peso Massimo
        <input
          type="number"
          min="100"
          max="300"
          value={config.limits.weight.max}
          onChange={(e) => updateConfig(['limits', 'weight', 'max'], parseInt(e.target.value))}
        />
      </label>
    </div>

    <h3>Altezza (cm)</h3>
    <div className={styles.formRow}>
      <label>
        Altezza Minima
        <input
          type="number"
          min="100"
          max="160"
          value={config.limits.height.min}
          onChange={(e) => updateConfig(['limits', 'height', 'min'], parseInt(e.target.value))}
        />
      </label>
      <label>
        Altezza Massima
        <input
          type="number"
          min="180"
          max="250"
          value={config.limits.height.max}
          onChange={(e) => updateConfig(['limits', 'height', 'max'], parseInt(e.target.value))}
        />
      </label>
    </div>

    <h3>Background - Campi di Testo</h3>
    <div className={styles.formRow}>
      <label>
        Breve Storia (min caratteri)
        <input
          type="number"
          min="50"
          max="500"
          value={config.limits.backgroundFields.briefHistoryMin}
          onChange={(e) => updateConfig(['limits', 'backgroundFields', 'briefHistoryMin'], parseInt(e.target.value))}
        />
        <small>Minimo caratteri per la storia del personaggio (default: 100)</small>
      </label>

      <label>
        Personalità (min caratteri)
        <input
          type="number"
          min="20"
          max="200"
          value={config.limits.backgroundFields.personalityMin}
          onChange={(e) => updateConfig(['limits', 'backgroundFields', 'personalityMin'], parseInt(e.target.value))}
        />
        <small>Minimo caratteri per la personalità (default: 50)</small>
      </label>
    </div>

    <div className={styles.formRow}>
      <label>
        Obiettivi (min caratteri)
        <input
          type="number"
          min="20"
          max="200"
          value={config.limits.backgroundFields.goalsMin}
          onChange={(e) => updateConfig(['limits', 'backgroundFields', 'goalsMin'], parseInt(e.target.value))}
        />
        <small>Minimo caratteri per gli obiettivi (default: 50)</small>
      </label>

      <label>
        Lunghezza Massima Totale
        <input
          type="number"
          min="1000"
          max="10000"
          value={config.limits.backgroundFields.maxLength}
          onChange={(e) => updateConfig(['limits', 'backgroundFields', 'maxLength'], parseInt(e.target.value))}
        />
        <small>Lunghezza massima complessiva per tutti i campi (default: 4000)</small>
      </label>
    </div>
  </div>
);

const SocialClassesTab: React.FC<TabProps> = ({ config, updateConfig }) => {
  const updateSocialClass = (index: number, field: string, value: any) => {
    const newClasses = [...config.socialClasses];
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      newClasses[index] = {
        ...newClasses[index],
        [parent]: {
          ...(newClasses[index] as any)[parent],
          [child]: value
        }
      };
    } else {
      newClasses[index] = { ...newClasses[index], [field]: value };
    }
    updateConfig(['socialClasses'], newClasses);
  };

  const addSocialClass = () => {
    const newClasses = [...config.socialClasses];
    // Find next available range
    const lastClass = newClasses[newClasses.length - 1];
    const nextMin = lastClass ? lastClass.financeSkillRange.max + 1 : 1;
    const nextMax = Math.min(nextMin + 9, 99);

    newClasses.push({
      id: `custom_${Date.now()}`,
      name: 'Nuova Classe',
      financeSkillRange: { min: nextMin, max: nextMax },
      weeklyCredit: 10,
      initialWealth: { minCash: 50, maxCash: 100 }
    });
    updateConfig(['socialClasses'], newClasses);
  };

  const removeSocialClass = (index: number) => {
    if (config.socialClasses.length <= 1) {
      alert('Deve esserci almeno una classe sociale!');
      return;
    }
    const newClasses = config.socialClasses.filter((_, i) => i !== index);
    updateConfig(['socialClasses'], newClasses);
  };

  return (
    <div className={styles.formGrid}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Classi Sociali Vittoriane</h2>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={addSocialClass}
        >
          + Aggiungi Classe
        </button>
      </div>
      <p className={styles.tabDescription}>
        Configura le classi sociali basate sul valore della skill FINANZA. Il range si calcola automaticamente: la prima classe parte da 1, le altre dal max della classe precedente + 1.
      </p>

      <div className={styles.socialClassesTable}>
        <table>
          <thead>
            <tr>
              <th>Classe</th>
              <th>Max FINANZA</th>
              <th>Range Effettivo</th>
              <th>Credito Settimanale (£)</th>
              <th>Ricchezza Iniziale (£)</th>
              <th style={{ width: '80px' }}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {config.socialClasses.map((sc, index) => {
              // Calculate min from previous class max
              const prevMax = index > 0 ? config.socialClasses[index - 1].financeSkillRange.max : 0;
              const calculatedMin = prevMax + 1;

              return (
                <tr key={sc.id}>
                  <td>
                    <input
                      type="text"
                      value={sc.name}
                      onChange={(e) => updateSocialClass(index, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={calculatedMin}
                      max="99"
                      value={sc.financeSkillRange.max}
                      onChange={(e) => {
                        const newMax = parseInt(e.target.value);
                        // Update min automatically
                        updateSocialClass(index, 'financeSkillRange.min', calculatedMin);
                        updateSocialClass(index, 'financeSkillRange.max', newMax);
                      }}
                      style={{ width: '60px' }}
                    />
                  </td>
                  <td style={{ textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>
                    {calculatedMin} - {sc.financeSkillRange.max}
                  </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={sc.weeklyCredit}
                    onChange={(e) => updateSocialClass(index, 'weeklyCredit', parseInt(e.target.value))}
                    style={{ width: '80px' }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={sc.initialWealth.minCash}
                    onChange={(e) => updateSocialClass(index, 'initialWealth.minCash', parseInt(e.target.value))}
                    style={{ width: '80px' }}
                  />
                  {' - '}
                  <input
                    type="number"
                    min="0"
                    value={sc.initialWealth.maxCash}
                    onChange={(e) => updateSocialClass(index, 'initialWealth.maxCash', parseInt(e.target.value))}
                    style={{ width: '80px' }}
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => removeSocialClass(index)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      color: '#f44336',
                      padding: '4px 8px'
                    }}
                    title="Rimuovi classe sociale"
                  >
                    🗑️
                  </button>
                </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const FormulasTab: React.FC<TabProps> = ({ config, updateConfig }) => {
  // State for formula validation and preview
  const [formulaErrors, setFormulaErrors] = useState<Record<string, string>>({});
  const [previewValues, setPreviewValues] = useState<Record<string, number>>({});

  // Test stats for preview (average character)
  const testStats: CharacterStats = {
    strength: 50,
    dexterity: 50,
    constitution: 50,
    size: 50,
    intelligence: 50,
    education: 50,
    power: 50,
    charm: 50
  };

  // Handler to update derived formula (non-blocking)
  const handleFormulaChange = (key: string, value: string) => {
    // Always update the config value (non-blocking - allows free editing)
    updateConfig(['formulas', 'derived', key], value);

    // Validate in background for preview/errors (informational only)
    const validation = validateDerivedFormula(value);

    if (validation.valid) {
      setFormulaErrors(prev => ({ ...prev, [key]: '' }));
      try {
        const preview = calculateDerivedStat(value, testStats);
        setPreviewValues(prev => ({ ...prev, [key]: preview }));
      } catch (error) {
        // Remove preview on error
        setPreviewValues(prev => {
          const newPrev = { ...prev };
          delete newPrev[key];
          return newPrev;
        });
      }
    } else {
      setFormulaErrors(prev => ({ ...prev, [key]: validation.error || '' }));
      // Remove preview on validation error
      setPreviewValues(prev => {
        const newPrev = { ...prev };
        delete newPrev[key];
        return newPrev;
      });
    }
  };

  const updateDamageBonus = (index: number, field: string, value: any) => {
    const newBonuses = [...config.formulas.damageBonus];
    newBonuses[index] = { ...newBonuses[index], [field]: value };
    updateConfig(['formulas', 'damageBonus'], newBonuses);
  };

  return (
    <div className={styles.formGrid}>
      <h2>Formule di Calcolo</h2>
      <p className={styles.tabDescription}>
        Configura le formule per caratteristiche derivate usando abbreviazioni UPPERCASE (STR, DEX, CON, SIZ, INT, EDU, POW, APP).
        Le funzioni supportate: FLOOR, CEIL, ROUND, MIN, MAX. Operatori: +, -, x, /, (, ).
      </p>

      <div className={styles.infoBox}>
        <strong>📝 Sintassi:</strong> Usa abbreviazioni MAIUSCOLE (es: <code>FLOOR((CON + SIZ) / 10)</code>).
        Preview calcolato con stats test: STR=50, DEX=50, CON=50, SIZ=50, INT=50, EDU=50, POW=50, APP=50.
      </div>

      <h3>Caratteristiche Derivate</h3>

      <div className={styles.formRow}>
        <label>
          Hit Points
          <input
            type="text"
            value={config.formulas.derived.hitPoints}
            onChange={(e) => handleFormulaChange('hitPoints', e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
          <small>
            Esempio: <code>FLOOR((CON + SIZ) / 10)</code>
            {!formulaErrors.hitPoints && previewValues.hitPoints !== undefined && (
              <> | <strong>Preview: {previewValues.hitPoints}</strong></>
            )}
          </small>
          {formulaErrors.hitPoints && (
            <div style={{ color: 'var(--error-text, #dc2626)', fontSize: '0.875rem', marginTop: '4px' }}>
              ⚠️ {formulaErrors.hitPoints}
            </div>
          )}
        </label>

        <label>
          Sanity Points
          <input
            type="text"
            value={config.formulas.derived.sanityPoints}
            onChange={(e) => handleFormulaChange('sanityPoints', e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
          <small>
            Esempio: <code>POW</code>
            {!formulaErrors.sanityPoints && previewValues.sanityPoints !== undefined && (
              <> | <strong>Preview: {previewValues.sanityPoints}</strong></>
            )}
          </small>
          {formulaErrors.sanityPoints && (
            <div style={{ color: 'var(--error-text, #dc2626)', fontSize: '0.875rem', marginTop: '4px' }}>
              ⚠️ {formulaErrors.sanityPoints}
            </div>
          )}
        </label>
      </div>

      <div className={styles.formRow}>
        <label>
          Magic Points
          <input
            type="text"
            value={config.formulas.derived.magicPoints}
            onChange={(e) => handleFormulaChange('magicPoints', e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
          <small>
            Esempio: <code>FLOOR(POW / 5)</code>
            {!formulaErrors.magicPoints && previewValues.magicPoints !== undefined && (
              <> | <strong>Preview: {previewValues.magicPoints}</strong></>
            )}
          </small>
          {formulaErrors.magicPoints && (
            <div style={{ color: 'var(--error-text, #dc2626)', fontSize: '0.875rem', marginTop: '4px' }}>
              ⚠️ {formulaErrors.magicPoints}
            </div>
          )}
        </label>

        <label>
          Luck Roll
          <input
            type="text"
            value={config.formulas.derived.luck}
            onChange={(e) => handleFormulaChange('luck', e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
          <small>
            Esempio: <code>POW</code>
            {!formulaErrors.luck && previewValues.luck !== undefined && (
              <> | <strong>Preview: {previewValues.luck}</strong></>
            )}
          </small>
          {formulaErrors.luck && (
            <div style={{ color: 'var(--error-text, #dc2626)', fontSize: '0.875rem', marginTop: '4px' }}>
              ⚠️ {formulaErrors.luck}
            </div>
          )}
        </label>
      </div>

      <div className={styles.formRow}>
        <label>
          Idea Roll
          <input
            type="text"
            value={config.formulas.derived.ideaRoll}
            onChange={(e) => handleFormulaChange('ideaRoll', e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
          <small>
            Esempio: <code>INT</code>
            {!formulaErrors.ideaRoll && previewValues.ideaRoll !== undefined && (
              <> | <strong>Preview: {previewValues.ideaRoll}</strong></>
            )}
          </small>
          {formulaErrors.ideaRoll && (
            <div style={{ color: 'var(--error-text, #dc2626)', fontSize: '0.875rem', marginTop: '4px' }}>
              ⚠️ {formulaErrors.ideaRoll}
            </div>
          )}
        </label>

        <label>
          Knowledge Roll
          <input
            type="text"
            value={config.formulas.derived.knowledge}
            onChange={(e) => handleFormulaChange('knowledge', e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
          <small>
            Esempio: <code>EDU</code>
            {!formulaErrors.knowledge && previewValues.knowledge !== undefined && (
              <> | <strong>Preview: {previewValues.knowledge}</strong></>
            )}
          </small>
          {formulaErrors.knowledge && (
            <div style={{ color: 'var(--error-text, #dc2626)', fontSize: '0.875rem', marginTop: '4px' }}>
              ⚠️ {formulaErrors.knowledge}
            </div>
          )}
        </label>
      </div>

      <div className={styles.formRow}>
        <label>
          Movement Rate
          <input
            type="text"
            value={config.formulas.derived.movementRate}
            onChange={(e) => handleFormulaChange('movementRate', e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
          <small>
            Esempio: <code>constant:8</code> o formula condizionale
            {!formulaErrors.movementRate && previewValues.movementRate !== undefined && (
              <> | <strong>Preview: {previewValues.movementRate}</strong></>
            )}
          </small>
          {formulaErrors.movementRate && (
            <div style={{ color: 'var(--error-text, #dc2626)', fontSize: '0.875rem', marginTop: '4px' }}>
              ⚠️ {formulaErrors.movementRate}
            </div>
          )}
        </label>
      </div>

      <h3>Tabella Bonus Danno</h3>
      <p className={styles.tabDescription}>
        Build e Damage Bonus sono calcolati automaticamente da questa tabella basandosi su STR + SIZ.
      </p>

      <div className={styles.damageBonusTable}>
        <table>
          <thead>
            <tr>
              <th>STR + SIZ Max</th>
              <th>Bonus Danno</th>
              <th>Build</th>
            </tr>
          </thead>
          <tbody>
            {config.formulas.damageBonus.map((bonus, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="number"
                    value={bonus.maxTotal}
                    onChange={(e) => updateDamageBonus(index, 'maxTotal', parseInt(e.target.value))}
                    style={{ width: '80px' }}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={bonus.bonus}
                    onChange={(e) => updateDamageBonus(index, 'bonus', e.target.value)}
                    style={{ width: '100px' }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={bonus.build}
                    onChange={(e) => updateDamageBonus(index, 'build', parseInt(e.target.value))}
                    style={{ width: '60px' }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.infoBox}>
        <strong>⚠️ Attenzione:</strong> Modifiche alla tabella bonus danno possono influenzare significativamente il bilanciamento del gioco.
        La tabella usa lookup: per ogni combinazione STR+SIZ trova il primo range dove il totale è ≤ maxTotal.
      </div>
    </div>
  );
};
