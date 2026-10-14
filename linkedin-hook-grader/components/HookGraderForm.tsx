'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  designation: z.string().max(100).optional(),
  email: z.string().email('Invalid email address'),
  hook: z.string().min(2, 'Hook must be at least 2 characters').max(500, 'Hook must be 500 characters or less'),
})

type FormData = z.infer<typeof formSchema>

interface HookGraderFormProps {
  onSubmit: (data: FormData) => Promise<void>
  isLoading: boolean
  error?: string
}

export function HookGraderForm({ onSubmit, isLoading, error }: HookGraderFormProps) {
  const [submitError, setSubmitError] = useState<string | undefined>(error)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
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
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg animate-fade-in" role="alert">
          {submitError}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-myntmore-primary dark:text-myntmore-light mb-1">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            {...register('name')}
            id="name"
            type="text"
            placeholder="John Doe"
            className={`w-full px-4 py-3 rounded-lg border ${
              errors.name
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-myntmore-gold focus:ring-myntmore-gold'
            } bg-white dark:bg-myntmore-secondary text-myntmore-primary dark:text-myntmore-light focus:ring-2 focus:ring-offset-0 transition-colors`}
            disabled={isLoading}
            aria-invalid={errors.name ? 'true' : 'false'}
            aria-describedby={errors.name ? 'name-error' : undefined}
          />
          {errors.name && (
            <p id="name-error" className="mt-1 text-sm text-red-500" role="alert">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="designation" className="block text-sm font-medium text-myntmore-primary dark:text-myntmore-light mb-1">
            Designation (Optional)
          </label>
          <input
            {...register('designation')}
            id="designation"
            type="text"
            placeholder="Founder & CEO"
            className={`w-full px-4 py-3 rounded-lg border ${
              errors.designation
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-myntmore-gold focus:ring-myntmore-gold'
            } bg-white dark:bg-myntmore-secondary text-myntmore-primary dark:text-myntmore-light focus:ring-2 focus:ring-offset-0 transition-colors`}
            disabled={isLoading}
          />
          {errors.designation && (
            <p className="mt-1 text-sm text-red-500" role="alert">{errors.designation.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-myntmore-primary dark:text-myntmore-light mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            {...register('email')}
            id="email"
            type="email"
            placeholder="john@example.com"
            className={`w-full px-4 py-3 rounded-lg border ${
              errors.email
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-myntmore-gold focus:ring-myntmore-gold'
            } bg-white dark:bg-myntmore-secondary text-myntmore-primary dark:text-myntmore-light focus:ring-2 focus:ring-offset-0 transition-colors`}
            disabled={isLoading}
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
          />
          {errors.email && (
            <p id="email-error" className="mt-1 text-sm text-red-500" role="alert">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="hook" className="block text-sm font-medium text-myntmore-primary dark:text-myntmore-light mb-1">
          LinkedIn Hook (First Two Lines) <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('hook')}
          id="hook"
          rows={4}
          placeholder="Paste the first two lines of your LinkedIn post here..."
          className={`w-full px-4 py-3 rounded-lg border ${
            errors.hook
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-myntmore-gold focus:ring-myntmore-gold'
            } bg-white dark:bg-myntmore-secondary text-myntmore-primary dark:text-myntmore-light focus:ring-2 focus:ring-offset-0 transition-colors resize-y min-h-[100px]`}
          disabled={isLoading}
          aria-invalid={errors.hook ? 'true' : 'false'}
          aria-describedby={errors.hook ? 'hook-error' : 'hook-hint'}
        />
        {errors.hook && (
          <p id="hook-error" className="mt-1 text-sm text-red-500" role="alert">{errors.hook.message}</p>
        )}
        <p id="hook-hint" className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Paste the first two lines of your LinkedIn post. We'll score it out of 100 and give you 3 rewrites.
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-6 bg-myntmore-primary dark:bg-myntmore-gold text-white dark:text-myntmore-primary font-medium rounded-lg hover:bg-myntmore-accent dark:hover:bg-yellow-500 focus:ring-2 focus:ring-myntmore-gold focus:ring-offset-2 dark:focus:ring-offset-myntmore-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Grading...
          </span>
        ) : (
          'Grade My Hook'
        )}
      </button>
    </form>
  )
}