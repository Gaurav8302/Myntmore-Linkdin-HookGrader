'use client'

import { RewriteCard } from '@/components/RewriteCard'

interface HookGraderResultsProps {
  score: number
  failedRules: string[]
  passedRules: string[]
  rewrites: Array<{ hook: string; reason: string }>
  fallback: boolean
  fallbackReason?: string
  onCopy: (text: string) => void
}

export function HookGraderResults({
  score,
  failedRules,
  passedRules,
  rewrites,
  fallback,
  fallbackReason,
  onCopy,
}: HookGraderResultsProps) {
  const label =
    score >= 80 ? 'Strong opener' : score >= 60 ? 'Solid, with gaps' : score >= 40 ? 'Needs work' : 'Weak opener'

  const barColor =
    score >= 80 ? 'bg-green-600' : score >= 60 ? 'bg-amber-500' : score >= 40 ? 'bg-orange-500' : 'bg-red-600'

  return (
    <div className="space-y-6">
      {fallback && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          <p className="font-semibold">AI rewrites unavailable</p>
          <p className="mt-1">
            {fallbackReason
              ? `Provider reported: ${fallbackReason}. Showing your original hook as a labelled fallback.`
              : 'Generation failed. Showing your original hook as a labelled fallback.'}
          </p>
          <p className="mt-1">Your deterministic score was still saved with this session.</p>
        </div>
      )}

      <div className="mm-panel p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-myntmore-muted">Score out of 100</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-6xl font-black tracking-tight text-myntmore-ink md:text-7xl">
                {score}
              </span>
              <span className="mb-2 text-lg text-myntmore-muted">/ 100</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-myntmore-body">{label}</p>
          </div>
          <div className="w-full md:max-w-sm">
            <div className="h-3 overflow-hidden rounded-full bg-myntmore-soft">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
                role="progressbar"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Hook score"
              />
            </div>
            <p className="mt-2 text-sm text-myntmore-muted">
              Deterministic score from six explicit rules. AI does not change this number.
            </p>
          </div>
        </div>
      </div>

      {failedRules.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h3 className="font-bold text-myntmore-danger">Areas to improve</h3>
          <ul className="mt-3 space-y-2">
            {failedRules.map((rule) => (
              <li key={rule} className="flex gap-2 text-sm text-red-900">
                <span aria-hidden className="mt-0.5 font-bold">
                  –
                </span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {passedRules.length > 0 && (
        <details className="rounded-2xl border border-green-200 bg-green-50 open:pb-2">
          <summary className="cursor-pointer list-none px-6 py-5 font-bold text-myntmore-success">
            What worked well ({passedRules.length})
          </summary>
          <ul className="space-y-2 px-6 pb-5">
            {passedRules.map((rule) => (
              <li key={rule} className="flex gap-2 text-sm text-green-900">
                <span aria-hidden>✓</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div>
        <h3 className="text-xl font-bold tracking-tight">Three rewrite options</h3>
        <p className="mt-1 text-sm text-myntmore-body">
          Pick the angle that sounds most like you, then edit before posting.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {rewrites.map((rewrite, index) => (
            <RewriteCard
              key={`${index}-${rewrite.hook.slice(0, 24)}`}
              index={index + 1}
              hook={rewrite.hook}
              reason={rewrite.reason}
              onCopy={onCopy}
              isFallback={fallback}
            />
          ))}
        </div>
      </div>

      <div className="mm-panel flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center">
        <div>
          <p className="font-bold">Want help turning hooks into booked meetings?</p>
          <p className="mt-1 text-sm text-myntmore-body">
            Talk with Myntmore about LinkedIn outreach and outbound systems.
          </p>
        </div>
        <a href="https://myntmore.com/founder-meeting" className="mm-btn-primary shrink-0">
          Book a founder meeting
        </a>
      </div>
    </div>
  )
}
