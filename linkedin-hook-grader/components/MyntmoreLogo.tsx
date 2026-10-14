import Image from 'next/image'

type MyntmoreLogoProps = {
  className?: string
  /** Visual size of the logo mark + wordmark row */
  size?: 'sm' | 'md'
  showWordmark?: boolean
}

/**
 * Official Myntmore mark from brand assets (icon + Mynt/more colour split in the PNG).
 */
export function MyntmoreLogo({
  className = '',
  size = 'sm',
  showWordmark = true,
}: MyntmoreLogoProps) {
  // Source asset is stacked (icon + wordmark), ~130×73.
  const height = size === 'md' ? 52 : 44
  const width = Math.round(height * (130 / 73))

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/myntmore-logo.png"
        alt="Myntmore"
        width={width}
        height={height}
        className="h-auto w-auto object-contain"
        priority
      />
      {showWordmark ? <span className="sr-only">Myntmore</span> : null}
    </span>
  )
}
