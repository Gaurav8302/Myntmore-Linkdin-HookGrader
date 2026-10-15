'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  designation: z.string().max(100).optional(),
  email: z.string().email('Enter a valid email address'),
  hook: z
    .string()
    .min(2, 'Hook must be at least 2 characters')
    .max(500, 'Hook must be 500 characters or less'),
})

type FormData = z.infer<typeof formSchema>

interface HookGraderFormProps {
  onSubmit: (data: FormData) => Promise<void>
  isLoading: boolean
  error?: string
}

export function HookGraderForm({ onSubmit, isLoading, error }: HookGraderFormProps) {
  const [submitError, setSubmitError] = useState<string | undefined>(error)

  useEffect(() => {
    setSubmitError(error)
  }, [error])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      designation: '',
      email: '',
      hook: '',
    },
  })

  const handleFormSubmit = async (data: FormData) => {
    setSubmitError(undefined)
    try {
      await onSubmit(data)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6" noValidate>
      {submitError && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-myntmore-danger"
          role="alert"
        >
          {submitError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          id="name"
          label="Full name"
          required
          error={errors.name?.message}
          disabled={isLoading}
        >
          <input
            {...register('name')}
            id="name"
            type="text"
            placeholder="Sarah Chen"
            disabled={isLoading}
            aria-invalid={errors.name ? 'true' : 'false'}
            className={`mm-input ${errors.name ? 'mm-input-error' : ''}`}
          />
        </Field>

        <Field
          id="designation"
          label="Designation"
          error={errors.designation?.message}
          disabled={isLoading}
        >
          <input
            {...register('designation')}
            id="designation"
            type="text"
            placeholder="Head of Growth"
            disabled={isLoading}
            className={`mm-input ${errors.designation ? 'mm-input-error' : ''}`}
          />
        </Field>
      </div>

      <Field id="email" label="Work email" required error={errors.email?.message} disabled={isLoading}>
        <input
          {...register('email')}
          id="email"
          type="email"
          placeholder="sarah@company.com"
          disabled={isLoading}
          aria-invalid={errors.email ? 'true' : 'false'}
          className={`mm-input ${errors.email ? 'mm-input-error' : ''}`}
        />
      </Field>

      <Field
        id="hook"
        label="LinkedIn hook (first two lines)"
        required
        error={errors.hook?.message}
        hint="Paste only the opening lines readers see before they decide to keep scrolling."
        disabled={isLoading}
      >
        <textarea
          {...register('hook')}
          id="hook"
          rows={5}
          placeholder="I cut our sales cycle from 90 days to 21 days by rewriting the first LinkedIn message. Want the 3-line template?"
          disabled={isLoading}
          aria-invalid={errors.hook ? 'true' : 'false'}
          className={`mm-input min-h-[140px] resize-y ${errors.hook ? 'mm-input-error' : ''}`}
        />
      </Field>

      <p className="rounded-xl border border-myntmore-line bg-myntmore-soft/60 px-3 py-2.5 text-xs leading-relaxed text-myntmore-body">
        Authority tip: first-person claims (I / I&apos;ve / we + a result) are optional and only help when they
        are truthful. Do not invent outcomes you did not achieve. Reader-focused questions and
        imperatives can still score well without personal claims.
      </p>

      <p className="text-xs leading-relaxed text-myntmore-muted">
        Your details are saved with this session so Myntmore can follow up on the result. Do not enter
        confidential information about other people.
      </p>

      <button type="submit" disabled={isLoading} className="mm-btn-primary w-full">
        {isLoading ? 'Grading…' : 'Grade My Hook'}
      </button>
    </form>
  )
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-myntmore-ink">
        {label}
        {required ? <span className="text-myntmore-danger"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-myntmore-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-myntmore-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
