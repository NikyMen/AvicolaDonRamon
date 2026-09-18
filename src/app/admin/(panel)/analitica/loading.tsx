export default function AnalyticsLoading() {
  return (
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <div>
        <div className="h-8 w-36 animate-pulse rounded-lg bg-black/10" />
        <div className="mt-2 h-4 w-72 max-w-full animate-pulse rounded bg-black/5" />
      </div>
      <div className="h-20 animate-pulse rounded-2xl bg-white shadow-soft" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-white shadow-soft" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-80 animate-pulse rounded-2xl bg-white shadow-soft" />
        <div className="h-80 animate-pulse rounded-2xl bg-white shadow-soft" />
      </div>
      <span className="sr-only">Cargando analítica…</span>
    </div>
  );
}
