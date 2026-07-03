// frontend/src/lib/ambassador-engine.ts
// ── Zentrale Reward- und Referral-Engine für das HUI Ambassador-System ───────

import { calcLevel, getRewardRate, getLevelForRefs, getNextLevel } from './ambassador-levels';
export type { AmbLevel } from './ambassador-levels';
export { calcLevel, getRewardRate, getLevelForRefs, getNextLevel } from './ambassador-levels';

// ── Referral-Link & Code Generierung ─────────────────────────────────────────
export function buildRefLink(username: string, userId: string): string {
  const clean = (username || '').replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
  return clean.length >= 3
    ? `https://be-hui.com/${clean}`
    : `https://be-hui.com/ref/${userId}`;
}

export function buildRefCode(username: string): string {
  return (username || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 5)
    .padEnd(5, 'X');
}

/** Validiert einen Referral-Code (5 alphanumerische Zeichen) */
export function validateReferralCode(code: string): boolean {
  return /^[A-Z0-9]{5}$/.test(code);
}

// ── Reward-Berechnungen ───────────────────────────────────────────────────────

/** Reward für eine neue Empfehlung (transaktionsbasiert) */
export function rewardForReferral(params: {
  referralCount: number;  // Anzahl bisheriger Empfehlungen (NACH dieser Empfehlung)
  transactionAmount: number; // EUR-Wert der Transaktion des neuen Nutzers
}): { eurAmount: number; rate: number; level: string } {
  const { referralCount, transactionAmount } = params;
  const rate   = getRewardRate(referralCount);
  const eurAmount = transactionAmount * rate;
  return { eurAmount, rate, level: calcLevel(referralCount) };
}

/** Reward beim Level-Aufstieg */
export function rewardForLevelUp(params: {
  newRefs: number;        // Neue Referral-Anzahl (nach Level-Up)
}): { bonusEur: number; newLevel: string; previousLevel: string } | null {
  const { newRefs } = params;
  if (newRefs <= 0) return null;

  const newLevel  = getLevelForRefs(newRefs);
  const prevLevel = getLevelForRefs(newRefs - 1);

  if (newLevel.level === prevLevel.level) return null; // Kein Level-Wechsel

  // COM-MIGRATION-015.3: Level-Slugs verschoben (bronze/silver/gold/platinum -> starter/bronze/silver/gold)
  const bonusMap: Record<string, number> = {
    bronze: 10,   // €10 Bonus für Bronze
    silver: 25,   // €25 Bonus für Silber
    gold:   50,   // €50 Bonus für Gold
  };

  return {
    bonusEur:      bonusMap[newLevel.level] ?? 0,
    newLevel:      newLevel.level,
    previousLevel: prevLevel.level,
  };
}

/** Signup-Bonus für den geworbenen Nutzer */
export function rewardForSignup(): { eurAmount: number; description: string } {
  return { eurAmount: 5, description: 'Willkommens-Bonus für Empfehlung' };
}

/** Milestone-Reward (alle 10 Empfehlungen) */
export function rewardForMilestone(referralCount: number): { bonus: number; milestone: number } | null {
  if (referralCount <= 0 || referralCount % 10 !== 0) return null;
  const bonus = referralCount <= 50 ? 5 : referralCount <= 100 ? 10 : 20;
  return { bonus, milestone: referralCount };
}

// ── Ambassador-Status Berechnung ─────────────────────────────────────────────
export function computeAmbassadorMetrics(params: {
  referralCount:  number;
  revenueGenerated: number;
}): {
  level:          string;
  levelDef:       ReturnType<typeof getLevelForRefs>;
  nextLevel:      ReturnType<typeof getNextLevel>;
  rewardRate:     number;
  estimatedReward: number;
} {
  const { referralCount, revenueGenerated } = params;
  const levelDef       = getLevelForRefs(referralCount);
  const nextLevel      = getNextLevel(referralCount);
  const rewardRate     = levelDef.rewardRate;
  const estimatedReward = revenueGenerated * rewardRate;

  return { level: levelDef.level, levelDef, nextLevel, rewardRate, estimatedReward };
}
