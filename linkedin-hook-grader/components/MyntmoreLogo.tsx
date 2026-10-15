import Image from 'next/image'

type MyntmoreLogoProps = {
  className?: string
  /** Visual size of the logo mark + wordmark row */
  size?: 'sm' | 'md'
  showWordmark?: boolean
}

/**
 * Official Myntmore mark from https://www.myntmore.com/logo.png
 * (stacked icon + Mynt/more colour-split wordmark).
 */
export function MyntmoreLogo({
  className = '',
  size = 'sm',
  showWordmark = true,
}: MyntmoreLogoProps) {
  // Official asset is 2058×1336 (stacked icon + wordmark).
  const height = size === 'md' ? 56 : 40
  const width = Math.round(height * (2058 / 1336))

  return (
    <span className={`inline-flex items-center ${className}`}>
      <Image
        src="/myntmore-logo.png"
        alt="Myntmore"
        width={width}
        height={height}
        className="h-auto w-auto max-w-full object-contain"
        priority
      />
      {showWordmark ? <span className="sr-only">Myntmore</span> : null}
    </span>
  )
}
