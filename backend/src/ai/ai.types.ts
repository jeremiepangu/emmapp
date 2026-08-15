import { Prisma } from '@prisma/client';

/** Facteur explicatif joint à chaque sortie de modèle (EF-IA-04). */
export interface ExplanationFactor {
  label: string;
  weight: number;
  detail?: string;
}

/** Indicateurs libres journalisés avec chaque exécution de modèle (EF-IA-05). */
export type ModelMetrics = Record<string, number | string>;

/** Compte rendu renvoyé par les routes d'exécution de modèle. */
export interface ModelRunResult {
  generated: number;
  modelName: string;
  modelVersion: string;
  mapePct?: number;
  metrics: ModelMetrics;
}

export const MS_PER_DAY = 86_400_000;
export const MS_PER_HOUR = 3_600_000;

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

export function mean(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

/** Pente d'une régression linéaire simple sur des points équidistants. */
export function linearSlope(values: number[]): number {
  const count = values.length;
  if (count < 2) return 0;
  const xMean = (count - 1) / 2;
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < count; index += 1) {
    numerator += (index - xMean) * (values[index] - yMean);
    denominator += (index - xMean) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

/** Convertit des contributions brutes en poids relatifs de somme 1 (EF-IA-04). */
export function normalizeWeights(contributions: number[]): number[] {
  const magnitudes = contributions.map((value) => (Number.isFinite(value) ? Math.abs(value) : 0));
  const total = sum(magnitudes);
  if (total <= 0) return magnitudes.map(() => round4(1 / magnitudes.length));
  return magnitudes.map((value) => round4(value / total));
}

export function round4(value: number): number {
  return Number(value.toFixed(4));
}

/** Numéro de jour UTC, utilisé comme index de série temporelle. */
export function epochDay(date: Date): number {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

export function dateFromEpochDay(day: number): Date {
  return new Date(day * MS_PER_DAY);
}

/** Les colonnes Json de Prisma refusent les propriétés optionnelles typées. */
export function toJsonFactors(factors: ExplanationFactor[]): Prisma.InputJsonValue {
  return factors as unknown as Prisma.InputJsonValue;
}

export function toJsonMetrics(metrics: ModelMetrics): Prisma.InputJsonValue {
  return metrics as unknown as Prisma.InputJsonValue;
}
