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
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400'
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
    if (score >= 40) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Needs Work'
    return 'Weak'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {fallback && (
        <div className="p-4 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg" role="alert">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">AI rewrites unavailable</span>
          </div>
          <p className="mt-1 text-sm">
            {fallbackReason ? `Reason: ${fallbackReason}` : 'Gemini API temporarily unavailable. Showing your original hook as fallback.'}
          </p>
          <p className="mt-1 text-sm">Your session was saved successfully with the deterministic score.</p>
        </div>
      )}

      {/* Score Display */}
      <div className="bg-white dark:bg-myntmore-secondary rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col items-center md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex flex-col items-center text-center md:text-left">
            <div className={`text-5xl md:text-7xl font-bold ${getScoreColor(score)}`}>{score}</div>
            <div className="mt-1 text-lg font-medium text-gray-600 dark:text-gray-300">/ 100</div>
            <div className={`mt-2 inline-block px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(score).replace('text', 'bg').replace('600', '100').replace('400', '100')} ${getScoreColor(score)}`}>
              {getScoreLabel(score)}
            </div>
          </div>

          <div className="w-full md:w-auto">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${getScoreColor(score).replace('text', 'bg')}`}
                style={{ width: `${score}%` }}
                role="progressbar"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Hook score"
              ></div>
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center md:text-right">
              Deterministic score based on 6 explicit rules
            </p>
          </div>
        </div>
      </div>

      {/* Failed Rules */}
      {failedRules.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <h3 className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold mb-4">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Areas to Improve
          </h3>
          <ul className="space-y-2">
            {failedRules.map((rule, index) => (
              <li key={index} className="flex items-start gap-2 text-red-700 dark:text-red-300 text-sm">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Passed Rules (collapsible) */}
      {passedRules.length > 0 && (
        <details className="group bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-semibold">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              What Worked Well ({passedRules.length})
            </div>
            <svg className="w-5 h-5 text-gray-400 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-6 pb-6 pt-0">
            <ul className="space-y-2">
              {passedRules.map((rule, index) => (
                <li key={index} className="flex items-start gap-2 text-green-700 dark:text-green-300 text-sm">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {/* Rewrites */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-myntmore-primary dark:text-myntmore-light flex items-center gap-2">
          <svg className="w-5 h-5 text-myntmore-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 000 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 00-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 000-4H7a1 1 0 01-1-1V8a1 1 0 011-1h3a1 1 0 001-1V5a2 2 0 014 0z" />
          </svg>
          3 AI Rewrites
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          {rewrites.map((rewrite, index) => (
            <RewriteCard
              key={index}
              index={index + 1}
              hook={rewrite.hook}
              reason={rewrite.reason}
              onCopy={onCopy}
              isFallback={fallback}
            />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-center text-gray-600 dark:text-gray-400 mb-4">
          Ready to book a call with Myntmore?
        </p>
        <a
          href="https://myntmore.com/founder-meeting"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block w-full md:w-auto px-6 py-3 bg-myntmore-gold text-myntmore-primary font-medium rounded-lg hover:bg-yellow-400 transition-colors text-center"
        >
          Book a Founder Meeting →
        </a>
      </div>
    </div>
  )
}