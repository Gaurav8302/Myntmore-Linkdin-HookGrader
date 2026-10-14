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
  const [formData, setFormData] = useState<FormData>({ name: '', designation: '', email: '', hook: '' })
  const [results, setResults] = useState<ResultsData | null>(null)
  const [error, setError] = useState<string | undefined>(undefined)

  const handleFormSubmit = async (data: FormData) => {
    setError(undefined)
    setFormData(data)
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
    setStep('form')
  }

  const handleCopy = (text: string) => {
    // Copy feedback is handled in the component
  }

  if (step === 'landing') {
    return (
      <main className="min-h-screen bg-myntmore-light dark:bg-myntmore-primary">
        <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
          {/* Hero Section */}
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-myntmore-gold/10 text-myntmore-gold text-sm font-medium mb-6">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Myntmore Free Tool
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-myntmore-primary dark:text-myntmore-light mb-6 leading-tight">
              Grade Your LinkedIn Hook
              <br />
              <span className="text-myntmore-gold">Get 3 AI Rewrites</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-2xl mx-auto">
              Paste the first two lines of your LinkedIn post. Get a deterministic score out of 100
              with specific feedback, plus 3 AI-powered rewrites that follow proven copywriting principles.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setStep('form')}
                className="w-full sm:w-auto px-8 py-4 bg-myntmore-primary dark:bg-myntmore-gold text-white dark:text-myntmore-primary font-semibold rounded-lg hover:bg-myntmore-accent dark:hover:bg-yellow-500 focus:ring-2 focus:ring-myntmore-gold focus:ring-offset-2 dark:focus:ring-offset-myntmore-primary transition-colors text-lg"
              >
                Start Grading Free
              </button>
              <a
                href="https://myntmore.com/founder-meeting"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-8 py-4 border-2 border-myntmore-primary dark:border-myntmore-gold text-myntmore-primary dark:text-myntmore-gold font-semibold rounded-lg hover:bg-myntmore-primary/5 dark:hover:bg-myntmore-gold/5 transition-colors text-lg"
              >
                Book a Founder Meeting
              </a>
            </div>
          </div>

          {/* Features */}
          <div className="mt-16 grid gap-8 md:grid-cols-3 animate-fade-in">
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              title="Deterministic Scoring"
              description="6 explicit rules, same hook = same score. No AI randomness, fully transparent."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              }
              title="3 AI Rewrites"
              description="Gemini 2.5 Flash generates 3 distinct rewrites with reasons. Structured JSON output."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              title="Secure & Private"
              description="Session saved to Supabase, webhook delivered via Make.com. No data sold or shared."
            />
          </div>
        </div>
      </main>
    )
  }

  if (step === 'form') {
    return (
      <main className="min-h-screen bg-myntmore-light dark:bg-myntmore-primary">
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
          <div className="animate-fade-in">
            <div className="mb-8 text-center">
              <a href="/" className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-myntmore-primary dark:hover:text-myntmore-light mb-6">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to landing
              </a>
              <h1 className="text-3xl md:text-4xl font-bold text-myntmore-primary dark:text-myntmore-light mb-2">
                Grade Your Hook
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Fill in your details and paste your LinkedIn hook
              </p>
            </div>

            <div className="bg-white dark:bg-myntmore-secondary rounded-2xl p-6 md:p-8 border border-gray-200 dark:border-gray-700">
              <HookGraderForm
                onSubmit={handleFormSubmit}
                isLoading={false}
                error={error}
              />
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (step === 'loading') {
    return (
      <main className="min-h-screen bg-myntmore-light dark:bg-myntmore-primary">
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
          <div className="animate-fade-in">
            <div className="mb-8 text-center">
              <h1 className="text-3xl md:text-4xl font-bold text-myntmore-primary dark:text-myntmore-light mb-2">
                Grading Your Hook...
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Running deterministic scoring & generating AI rewrites
              </p>
            </div>

            <div className="bg-white dark:bg-myntmore-secondary rounded-2xl p-6 md:p-8 border border-gray-200 dark:border-gray-700">
              <LoadingState />
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (step === 'results' && results) {
    return (
      <main className="min-h-screen bg-myntmore-light dark:bg-myntmore-primary pb-12">
        <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
          <div className="animate-fade-in">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-myntmore-primary dark:text-myntmore-light mb-2">
                  Your Hook Score
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Session saved successfully
                </p>
              </div>
              <button
                onClick={handleRetry}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Grade Another Hook
              </button>
            </div>

            <div className="bg-white dark:bg-myntmore-secondary rounded-2xl p-6 md:p-8 border border-gray-200 dark:border-gray-700">
              <HookGraderResults
                score={results.score}
                failedRules={results.failedRules}
                passedRules={results.passedRules}
                rewrites={results.rewrites}
                fallback={results.fallback}
                fallbackReason={results.fallbackReason}
                onCopy={handleCopy}
              />
            </div>
          </div>
        </div>
      </main>
    )
  }

  return null
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-myntmore-secondary rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-myntmore-gold/50 transition-colors">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-myntmore-gold/10 text-myntmore-gold mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-myntmore-primary dark:text-myntmore-light mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  )
}