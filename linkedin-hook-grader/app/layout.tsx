import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LinkedIn Hook Grader | Myntmore',
  description:
    'Grade the first two lines of your LinkedIn post with a rule-based score and get three improved rewrite alternatives.',
  openGraph: {
    title: 'LinkedIn Hook Grader | Myntmore',
    description:
      'Grade the first two lines of your LinkedIn post with a rule-based score and get three improved rewrite alternatives.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-myntmore-canvas font-sans text-myntmore-ink antialiased">
        {children}
      </body>
    </html>
  )
}
