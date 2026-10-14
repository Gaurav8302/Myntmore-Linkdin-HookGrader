'use client'

import { useState } from 'react'

interface RewriteCardProps {
  index: number
  hook: string
  reason: string
  onCopy: (text: string) => void
  isFallback: boolean
}

export function RewriteCard({ index, hook, reason, onCopy, isFallback }: RewriteCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(hook)
    onCopy(hook)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`bg-white dark:bg-myntmore-secondary rounded-xl p-5 border ${
      isFallback ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20' : 'border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <span className={`font-bold text-lg ${isFallback ? 'text-amber-700 dark:text-amber-300' : 'text-myntmore-primary dark:text-myntmore-light'}`}>
          Rewrite {index}
        </span>
        {isFallback && (
          <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 rounded-full">
            Fallback
          </span>
        )}
      </div>

      <div className="mb-3">
        <p className="text-myntmore-primary dark:text-myntmore-light font-medium leading-relaxed">"{hook}"</p>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-gray-100">Why:</span> {reason}
        </p>
        <button
          onClick={handleCopy}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            copied
              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
        >
          {copied ? (
            <>
              <svg className="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 012-2h10a2 2 0 012 2v1M8 5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  )
}