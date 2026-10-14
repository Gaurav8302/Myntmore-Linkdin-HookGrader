'use client'

export function LoadingState() {
  return (
    <div className="animate-fade-in space-y-6">
      {/* Score skeleton */}
      <div className="bg-white dark:bg-myntmore-secondary rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col items-center md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex flex-col items-center text-center md:text-left">
            <div className="h-16 w-32 md:h-24 md:w-48 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse-slow" />
            <div className="mt-2 h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse-slow" />
            <div className="mt-2 h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse-slow" />
          </div>
          <div className="w-full md:w-auto">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gray-300 dark:bg-gray-600 animate-pulse-slow" style={{ width: '60%' }} />
            </div>
            <div className="mt-2 h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse-slow" />
          </div>
        </div>
      </div>

      {/* Failed rules skeleton */}
      <div className="bg-white dark:bg-myntmore-secondary rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse-slow mb-4" />
        <div className="space-y-3">
          <div className="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse-slow" />
          <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse-slow" />
          <div className="h-5 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse-slow" />
        </div>
      </div>

      {/* Rewrites skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white dark:bg-myntmore-secondary rounded-xl p-5 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse-slow" />
            </div>
            <div className="h-5 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse-slow mb-3" />
            <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse-slow" />
              <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse-slow" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}