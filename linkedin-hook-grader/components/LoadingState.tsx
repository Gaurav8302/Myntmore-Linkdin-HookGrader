'use client'

export function LoadingState() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <p className="text-center text-sm font-medium text-myntmore-body">
        Scoring rules first, then generating three rewrite options…
      </p>
      <div className="mm-panel p-8">
        <div className="mx-auto h-16 w-28 rounded-2xl bg-myntmore-soft animate-pulse-slow" />
        <div className="mx-auto mt-4 h-3 w-full max-w-sm rounded-full bg-myntmore-soft animate-pulse-slow" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="mm-panel space-y-3 p-5">
            <div className="h-5 w-24 rounded bg-myntmore-soft animate-pulse-slow" />
            <div className="h-16 w-full rounded bg-myntmore-soft animate-pulse-slow" />
            <div className="h-4 w-3/4 rounded bg-myntmore-soft animate-pulse-slow" />
          </div>
        ))}
      </div>
    </div>
  )
}
