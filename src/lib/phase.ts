// Phase comes from the session date. Range is [startDate, endDate).

export type PhaseWindow = {
  id: string;
  name: string;
  phaseType: string;
  startDate: Date;
  endDate: Date | null;
};

export function derivePhase(
  sessionDate: Date,
  phases: PhaseWindow[],
): PhaseWindow | null {
  const t = sessionDate.getTime();

  return (
    phases.find((phase) => {
      const start = phase.startDate.getTime();
      const end = phase.endDate ? phase.endDate.getTime() : Number.POSITIVE_INFINITY;
      return t >= start && t < end;
    }) ?? null
  );
}

export function meanOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
