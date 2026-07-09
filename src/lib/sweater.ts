export interface SweaterVerdict { score: number; verdict: string; layers: string; }

export function effectiveTemp(high: number, current: number): number {
  return high * 0.5 + current * 0.5;
}

export function sweaterFromEffective(effective: number): SweaterVerdict {
  if (effective < 35) return { score: 5, verdict: "That's not sweater weather, that's SWEATER EMERGENCY.", layers: "3+" };
  if (effective < 45) return { score: 4, verdict: "Classic sweater weather. This is what we're here for.", layers: "2" };
  if (effective < 55) return { score: 3, verdict: "Still sweater territory. Don't let anyone tell you otherwise.", layers: "1-2" };
  if (effective < 65) return { score: 2, verdict: "You could go either way. Bring it and decide later.", layers: "0-1" };
  if (effective < 75) return { score: 1, verdict: "No sweater needed unless you're in aggressive AC.", layers: "0" };
  return { score: 0, verdict: "Wearing a sweater would be a cry for help.", layers: "0" };
}

export function rayCount(score: number): number {
  return score ? Math.min(5, Math.round(score / 20)) : 0;
}
