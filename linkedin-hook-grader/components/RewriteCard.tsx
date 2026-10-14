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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(hook)
      onCopy(hook)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <article
      className={`flex h-full flex-col rounded-2xl border p-5 ${
        isFallback
          ? 'border-amber-200 bg-amber-50'
          : 'border-myntmore-line bg-white shadow-panel'
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="font-bold text-myntmore-ink">Rewrite {index}</h4>
        {isFallback ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            Fallback
          </span>
        ) : null}
      </div>

      <p className="flex-1 text-[15px] font-medium leading-relaxed text-myntmore-ink">&ldquo;{hook}&rdquo;</p>

      <div className="mt-4 border-t border-myntmore-line pt-3">
        <p className="text-sm text-myntmore-body">
          <span className="font-semibold text-myntmore-ink">Why: </span>
          {reason}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className={`mt-3 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            copied
              ? 'bg-green-100 text-green-800'
              : 'bg-myntmore-soft text-myntmore-ink hover:bg-myntmore-yellowSoft'
          }`}
          aria-label={copied ? 'Copied to clipboard' : 'Copy rewrite'}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </article>
  )
}
