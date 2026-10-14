'use client'

import { useState } from 'react'
import { HookGraderForm } from '@/components/HookGraderForm'
import { HookGraderResults } from '@/components/HookGraderResults'
import { LoadingState } from '@/components/LoadingState'

type FormData = {
  name: string
  designation?: string
  email: string
  hook: string
}

type ResultsData = {
  sessionId: string
  score: number
  failedRules: string[]
  passedRules: string[]
  rewrites: Array<{ hook: string; reason: string }>
  fallback: boolean
  fallbackReason?: string
}

export default function Home() {
  const [step, setStep] = useState<'landing' | 'form' | 'loading' | 'results'>('landing')
  const [results, setResults] = useState<ResultsData | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)

  const handleFormSubmit = async (data: FormData) => {
    setError(undefined)
    setStep('loading')

    try {
      const response = await fetch('/api/grade-hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || 'Failed to grade hook')
      }

      setResults(result)
      setStep('results')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setStep('form')
    }
  }

  const handleRetry = () => {
    setResults(null)
    setError(undefined)
    setStep('form')
  }

  const goToGrader = () => {
    setStep('form')
    requestAnimationFrame(() => {
      document.getElementById('grader')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  return (
    <div className="min-h-screen bg-myntmore-canvas text-myntmore-ink">
      <SiteHeader onGrade={goToGrader} />

      {step === 'landing' && <Landing onGrade={goToGrader} />}

      {(step === 'form' || step === 'loading' || step === 'results') && (
        <section id="grader" className="border-t border-myntmore-line bg-myntmore-soft/40">
          <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
            {step === 'form' && (
              <div className="animate-fade-in">
                <div className="mb-8">
                  <button
                    type="button"
                    onClick={() => setStep('landing')}
                    className="mb-4 text-sm font-medium text-myntmore-muted hover:text-myntmore-ink"
                  >
                    ← Back to overview
                  </button>
                  <h1 className="text-3xl font-black tracking-tight md:text-4xl">Grade your hook</h1>
                  <p className="mt-2 text-myntmore-body">
                    Add your details, paste the first two lines of your LinkedIn post, and get a
                    rule-based score plus three rewrite options.
                  </p>
                </div>
                <div className="mm-panel p-6 md:p-8">
                  <HookGraderForm onSubmit={handleFormSubmit} isLoading={false} error={error} />
                </div>
              </div>
            )}

            {step === 'loading' && (
              <div className="animate-fade-in">
                <div className="mb-8 text-center">
                  <h1 className="text-3xl font-black tracking-tight md:text-4xl">Grading your hook</h1>
                  <p className="mt-2 text-myntmore-body">
                    Running the six scoring rules, then generating three rewrite options.
                  </p>
                </div>
                <div className="mm-panel p-6 md:p-8">
                  <LoadingState />
                </div>
              </div>
            )}

            {step === 'results' && results && (
              <div className="animate-fade-in">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h1 className="text-3xl font-black tracking-tight md:text-4xl">Your results</h1>
                    <p className="mt-2 text-myntmore-body">
                      Score is rule-based. Rewrites are AI-assisted suggestions you can edit before posting.
                    </p>
                  </div>
                  <button type="button" onClick={handleRetry} className="mm-btn-secondary">
                    Grade another hook
                  </button>
                </div>
                <HookGraderResults
                  score={results.score}
                  failedRules={results.failedRules}
                  passedRules={results.passedRules}
                  rewrites={results.rewrites}
                  fallback={results.fallback}
                  fallbackReason={results.fallbackReason}
                  onCopy={() => undefined}
                />
              </div>
            )}
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  )
}

function SiteHeader({ onGrade }: { onGrade: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-myntmore-line/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <a href="https://myntmore.com" className="flex items-center gap-2 font-black tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-myntmore-yellow text-sm text-myntmore-ink">
            M
          </span>
          <span>
            Myntmore
            <span className="ml-2 hidden text-sm font-medium text-myntmore-muted sm:inline">
              Free Tools
            </span>
          </span>
        </a>
        <nav className="hidden items-center gap-6 text-sm font-medium text-myntmore-body md:flex">
          <a href="https://www.myntmore.com/resources/tools" className="hover:text-myntmore-ink">
            All tools
          </a>
          <a href="https://www.myntmore.com/tools/linkedin-optimizer" className="hover:text-myntmore-ink">
            Profile Optimizer
          </a>
          <a href="https://myntmore.com/founder-meeting" className="hover:text-myntmore-ink">
            Book a call
          </a>
        </nav>
        <button type="button" onClick={onGrade} className="mm-btn-primary px-4 py-2.5 text-sm">
          Grade Your Hook
        </button>
      </div>
    </header>
  )
}

function Landing({ onGrade }: { onGrade: () => void }) {
  return (
    <main>
      {/* Hero — mirrors Myntmore tool pages: light canvas, black display type, yellow CTA */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(255,194,71,0.28), transparent 60%)',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 md:pb-24 md:pt-20">
          <p className="mb-4 text-sm font-semibold text-myntmore-muted">
            Free LinkedIn writing tool
          </p>
          <h1 className="max-w-4xl text-4xl font-black leading-[1.08] tracking-tight md:text-6xl">
            Grade the first two lines of your LinkedIn post.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-myntmore-body md:text-xl">
            Most readers decide whether to keep scrolling in the first two lines. Get a transparent,
            rule-based score and three sharper rewrite options you can paste and edit.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onGrade} className="mm-btn-primary">
              Grade Your Hook
            </button>
            <a href="https://myntmore.com/founder-meeting" className="mm-btn-secondary">
              Book a founder meeting
            </a>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-myntmore-line bg-myntmore-soft/50">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <h2 className="text-3xl font-black tracking-tight md:text-4xl">How it works</h2>
          <p className="mt-3 max-w-2xl text-myntmore-body">
            Three steps from a rough opener to options you can ship.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <StepCard
              n="01"
              title="Paste your hook"
              body="Drop in the first two lines of your LinkedIn post. No scraping, no profile URL required."
            />
            <StepCard
              n="02"
              title="Get a rule-based score"
              body="Six explicit checks score the hook from 0–100. Same wording always returns the same score."
            />
            <StepCard
              n="03"
              title="Compare three rewrites"
              body="Review three AI-generated alternatives with short reasons, then copy the one that fits your voice."
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-myntmore-line">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <h2 className="text-3xl font-black tracking-tight md:text-4xl">What you get</h2>
          <p className="mt-3 max-w-2xl text-myntmore-body">
            Built like Myntmore’s other free LinkedIn tools: clear checks, concrete outputs, no
            mystery scoring.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <FeatureBlock
              title="Deterministic scoring"
              body="Length, curiosity, specificity, authority, action, and clickbait patterns are checked in code. The model never sets your score."
            />
            <FeatureBlock
              title="Three rewrite alternatives"
              body="NVIDIA generates three distinct options with reasons. If generation fails, you still keep your score and a transparent fallback."
            />
          </div>
        </div>
      </section>

      {/* Transition into grader */}
      <section className="border-t border-myntmore-line bg-myntmore-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-14 md:flex-row md:items-center md:py-16">
          <div className="max-w-xl">
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">
              Ready to grade your hook?
            </h2>
            <p className="mt-3 text-white/75">
              Share your name and email, paste your opener, and get feedback in seconds.
            </p>
          </div>
          <button
            type="button"
            onClick={onGrade}
            className="mm-btn-primary shrink-0"
          >
            Grade Your Hook
          </button>
        </div>
      </section>
    </main>
  )
}

function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="mm-panel p-6">
      <div className="text-sm font-bold text-myntmore-muted">{n}</div>
      <h3 className="mt-3 text-xl font-bold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-myntmore-body">{body}</p>
    </div>
  )
}

function FeatureBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-myntmore-line bg-myntmore-yellowSoft/40 p-6 md:p-8">
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      <p className="mt-3 text-myntmore-body">{body}</p>
    </div>
  )
}

function SiteFooter() {
  return (
    <footer className="border-t border-myntmore-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 font-black">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-myntmore-yellow text-sm">
              M
            </span>
            Myntmore
          </div>
          <p className="mt-3 text-sm text-myntmore-body">
            B2B growth systems for companies that want predictable pipeline.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-bold">Tools & resources</h3>
          <ul className="mt-3 space-y-2 text-sm text-myntmore-body">
            <li>
              <a className="hover:text-myntmore-ink" href="https://www.myntmore.com/resources/tools">
                Free tools
              </a>
            </li>
            <li>
              <a
                className="hover:text-myntmore-ink"
                href="https://www.myntmore.com/tools/linkedin-optimizer"
              >
                LinkedIn Profile Optimizer
              </a>
            </li>
            <li>
              <a className="hover:text-myntmore-ink" href="https://myntmore.com">
                myntmore.com
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-bold">Contact</h3>
          <ul className="mt-3 space-y-2 text-sm text-myntmore-body">
            <li>
              <a className="hover:text-myntmore-ink" href="mailto:growth@myntmore.com">
                growth@myntmore.com
              </a>
            </li>
            <li>
              <a className="hover:text-myntmore-ink" href="https://myntmore.com/founder-meeting">
                Book a Free GTM Audit
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-myntmore-line px-4 py-4 text-center text-xs text-myntmore-muted">
        © {new Date().getFullYear()} Myntmore LinkedIn Hook Grader. Built for professionals who want
        clearer LinkedIn openers.
      </div>
    </footer>
  )
}
