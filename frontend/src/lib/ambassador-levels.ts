// frontend/src/lib/ambassador-levels.ts
// ── Zentrale Level-Definition für das HUI Ambassador-System ─────────────────

// COM-MIGRATION-015.3: Level-Namen + Provisionsraten neu (Starter/Bronze/Silber/Gold, 5/10/15/20%).
// Schwellen unveraendert (auf Wunsch von Michael, 2026-07-03). rewardRate = Anteil AM UNTERNEHMENSANTEIL
// (85% der 15%-Gebuehr), NICHT mehr am Bruttoumsatz -- siehe rpc_process_order_fees in be-hui.
export type AmbLevel = 'starter' | 'bronze' | 'silver' | 'gold';

export interface LevelDef {
  level:    AmbLevel;
  label:    string;
  icon:     string;
  color:    string;
  bg:       string;
  minRefs:  number;   // minimale Empfehlungen für dieses Level
  maxRefs:  number;   // maximale Empfehlungen (inklusiv), Infinity für letztes Level
  rewardRate: number; // Anteil am Unternehmensanteil (10% des Bruttoumsatzes), z.B. 0.05 = 5 %
}

export const AMBASSADOR_LEVELS: LevelDef[] = [
  { level: 'starter', label: 'Starter', icon: '🌱', color: '#69DB7C', bg: 'rgba(105,219,124,0.12)',  minRefs: 0,   maxRefs: 10,       rewardRate: 0.05 },
  { level: 'bronze',  label: 'Bronze',  icon: '🥉', color: '#CD7F32', bg: 'rgba(205,127,50,0.12)',   minRefs: 11,  maxRefs: 50,       rewardRate: 0.10 },
  { level: 'silver',  label: 'Silber',  icon: '🥈', color: '#C0C0C0', bg: 'rgba(192,192,192,0.12)',  minRefs: 51,  maxRefs: 200,      rewardRate: 0.15 },
  { level: 'gold',    label: 'Gold',    icon: '🥇', color: '#FFD700', bg: 'rgba(255,215,0,0.12)',    minRefs: 201, maxRefs: Infinity, rewardRate: 0.20 },
];

/** Gibt die Level-Definition für eine gegebene Referral-Anzahl zurück */
export function getLevelForRefs(referralCount: number): LevelDef {
  for (let i = AMBASSADOR_LEVELS.length - 1; i >= 0; i--) {
    if (referralCount >= AMBASSADOR_LEVELS[i].minRefs) {
      return AMBASSADOR_LEVELS[i];
    }
  }
  return AMBASSADOR_LEVELS[0]; // Default: Bronze
}

/** Gibt das nächste Level zurück (oder null wenn bereits Platin) */
export function getNextLevel(referralCount: number): LevelDef | null {
  const current = getLevelForRefs(referralCount);
  const idx = AMBASSADOR_LEVELS.findIndex(l => l.level === current.level);
  return idx < AMBASSADOR_LEVELS.length - 1 ? AMBASSADOR_LEVELS[idx + 1] : null;
}

/** Gibt die Reward-Rate für eine Referral-Anzahl zurück */
export function getRewardRate(referralCount: number): number {
  return getLevelForRefs(referralCount).rewardRate;
}

/** Gibt den Level-Namen (string) zurück — Kurzform für Backwards-Compat */
export function calcLevel(referralCount: number): AmbLevel {
  return getLevelForRefs(referralCount).level;
}

/** Fortschritt bis zum nächsten Level (0–1) */
export function getLevelProgress(referralCount: number): number {
  const current = getLevelForRefs(referralCount);
  const next    = getNextLevel(referralCount);
  if (!next) return 1; // Platin → 100 %
  const range = next.minRefs - current.minRefs;
  const done  = referralCount - current.minRefs;
  return Math.min(1, done / range);
}
