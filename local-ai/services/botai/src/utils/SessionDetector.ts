const SESSION_GAP_MS = 3 * 60 * 60 * 1000; // 3 ore
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

export interface TimePassageInfo {
  isNewSession: boolean;
  category: 'same_session' | 'hours_apart' | 'days_apart' | 'weeks_apart' | 'months_apart';
  narrativeHint: string;
}

export function detectTimePassage(lastInteraction: Date | null, now?: Date): TimePassageInfo {
  if (!lastInteraction) {
    return { isNewSession: false, category: 'same_session', narrativeHint: '' };
  }

  const nowMs = (now ?? new Date()).getTime();
  const gapMs = nowMs - new Date(lastInteraction).getTime();

  if (gapMs < SESSION_GAP_MS) {
    return { isNewSession: false, category: 'same_session', narrativeHint: '' };
  }

  const category = categorizeGap(gapMs);

  return {
    isNewSession: true,
    category,
    narrativeHint: NARRATIVE_HINTS[category],
  };
}

function categorizeGap(gapMs: number): TimePassageInfo['category'] {
  if (gapMs < ONE_DAY_MS) return 'hours_apart';
  if (gapMs < ONE_WEEK_MS) return 'days_apart';
  if (gapMs < ONE_MONTH_MS) return 'weeks_apart';
  return 'months_apart';
}

const NARRATIVE_HINTS: Record<TimePassageInfo['category'], string> = {
  same_session: '',
  hours_apart: 'Non vedi questa persona da qualche ora.',
  days_apart: "Sono passati alcuni giorni dall'ultima volta che hai visto questa persona.",
  weeks_apart: 'Non vedi questa persona da diverse settimane.',
  months_apart: "È passato molto tempo dall'ultima volta che hai incontrato questa persona.",
};
