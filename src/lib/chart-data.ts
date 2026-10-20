import { prisma } from "@/lib/db";
import { derivePhase, meanOf, type PhaseWindow } from "@/lib/phase";

export type ChartPoint = {
  iso: string;
  value: number | null;
  valueState: string;
  phaseName: string | null;
  phaseType: string | null;
};

export type ChartSeries = {
  clientName: string;
  behaviorId: string;
  behaviorName: string;
  unit: string;
  direction: string;
  points: ChartPoint[];
  phases: Array<PhaseWindow & { mean: number | null }>;
};

export type ChartCatalog = {
  clientName: string;
  behaviors: Array<{ id: string; name: string }>;
};

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function loadCatalog(): Promise<ChartCatalog | null> {
  const client = await prisma.client.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      behaviors: { orderBy: { createdAt: "asc" }, select: { id: true, name: true } },
    },
  });

  if (!client) return null;
  return { clientName: client.displayName, behaviors: client.behaviors };
}

export async function loadSeries(behaviorId: string): Promise<ChartSeries | null> {
  const behavior = await prisma.behavior.findUnique({
    where: { id: behaviorId },
    include: {
      client: true,
      phases: { orderBy: { startDate: "asc" } },
      measurements: {
        include: { observationSession: true },
        orderBy: { observationSession: { sessionDate: "asc" } },
      },
    },
  });

  if (!behavior) return null;

  const phaseWindows: PhaseWindow[] = behavior.phases.map((phase) => ({
    id: phase.id,
    name: phase.name,
    phaseType: phase.phaseType,
    startDate: phase.startDate,
    endDate: phase.endDate,
  }));

  const points: ChartPoint[] = behavior.measurements.map((row) => {
    const phase = derivePhase(row.observationSession.sessionDate, phaseWindows);
    return {
      iso: toIsoDate(row.observationSession.sessionDate),
      value: row.normalizedValue,
      valueState: row.valueState,
      phaseName: phase?.name ?? null,
      phaseType: phase?.phaseType ?? null,
    };
  });

  const phases = phaseWindows.map((phase) => ({
    ...phase,
    mean: meanOf(
      points
        .filter((point) => point.phaseName === phase.name && point.value !== null)
        .map((point) => point.value as number),
    ),
  }));

  return {
    clientName: behavior.client.displayName,
    behaviorId: behavior.id,
    behaviorName: behavior.name,
    unit: behavior.measurements[0]?.unit ?? behavior.measurementType,
    direction: behavior.direction,
    points,
    phases,
  };
}
