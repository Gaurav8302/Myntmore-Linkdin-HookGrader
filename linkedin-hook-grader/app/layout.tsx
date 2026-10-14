import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LinkedIn Hook Grader | Myntmore',
  description: 'Grade your LinkedIn post hook and get 3 AI-powered rewrites. Score your first two lines out of 100.',
  openGraph: {
    title: 'LinkedIn Hook Grader | Myntmore',
    description: 'Grade your LinkedIn post hook and get 3 AI-powered rewrites.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-myntmore-light dark:bg-myntmore-primary text-myntmore-primary dark:text-myntmore-light">
        {children}
      </body>
    </html>
  )
}