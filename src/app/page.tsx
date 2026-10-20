import Link from "next/link";
import { PhaseChart } from "@/app/phase-chart";
import { loadCatalog, loadSeries } from "@/lib/chart-data";

type HomeProps = {
  searchParams: Promise<{ behavior?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;

  let catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database unavailable";
    return (
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold">Behavior Intelligence</h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          The chart reads the local Postgres seed. Start the database, then run
          `npm run db:seed`.
        </p>
        <pre className="mt-4 overflow-auto rounded-lg border border-neutral-200 p-3 text-xs dark:border-neutral-800">
          {message}
        </pre>
      </main>
    );
  }

  if (!catalog || catalog.behaviors.length === 0) {
    return (
      <main className="mx-auto max-w-3xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold">Behavior Intelligence</h1>
        <p className="mt-3 text-sm text-neutral-600">
          No seeded client yet. Run `npm run db:seed`.
        </p>
      </main>
    );
  }

  const selectedId = params.behavior ?? catalog.behaviors[0].id;
  const series = await loadSeries(selectedId);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Synthetic demo · client {catalog.clientName}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Behavior Intelligence
        </h1>
        <p className="max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Single-case design chart: one series per behavior, phase lines from
          dates (not a stored phase id), open markers for censored values.
          No real client data.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2">
        {catalog.behaviors.map((behavior) => {
          const active = behavior.id === selectedId;
          return (
            <Link
              key={behavior.id}
              href={`/?behavior=${behavior.id}`}
              className={
                active
                  ? "rounded-full bg-neutral-900 px-3 py-1 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "rounded-full border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
              }
            >
              {behavior.name}
            </Link>
          );
        })}
      </nav>

      {series ? (
        <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-medium">{series.behaviorName}</h2>
            <p className="text-xs text-neutral-500">
              {series.unit} · goal is {series.direction.toLowerCase()}
            </p>
          </div>
          <PhaseChart series={series} />
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {series.phases.map((phase) => (
              <div key={phase.id}>
                <dt className="text-neutral-500">{phase.name}</dt>
                <dd className="font-medium">
                  {phase.mean === null ? "—" : `mean ${phase.mean.toFixed(2)}`}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : (
        <p className="text-sm text-neutral-600">That behavior was not found.</p>
      )}
    </main>
  );
}
