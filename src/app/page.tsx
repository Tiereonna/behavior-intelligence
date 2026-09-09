/**
 * Placeholder landing page.
 *
 * Milestone 1 is the data foundation only: schema, migration, measurement
 * subsystem, and seed data. The dashboard, charts, and analytics arrive in
 * later milestones, so there is deliberately no UI here yet.
 */
export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Behavior Intelligence
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Longitudinal behavior data for behavioral professionals.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 p-5 dark:border-neutral-800">
        <p className="text-sm font-medium">Milestone 1 complete</p>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          Database schema, migration, measurement subsystem, and synthetic seed
          data are in place. Inspect the seeded records with{" "}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs dark:bg-neutral-800">
            npm run db:studio
          </code>
          .
        </p>
      </div>
    </main>
  );
}
