import './common.css'

export type SkeletonProps = {
  label?: string
  lines?: number
  variant?: 'text' | 'card' | 'list'
}

/**
 * 시각적 placeholder와 screen reader용 loading 설명을 함께 제공한다.
 */
export function Skeleton({
  label = '콘텐츠를 불러오는 중입니다.',
  lines = 3,
  variant = 'text',
}: SkeletonProps) {
  const normalizedLineCount = Math.min(Math.max(lines, 1), 8)

  return (
    <div
      aria-busy="true"
      className={`moodi-common-skeleton is-${variant}`}
      role="status"
    >
      <span className="moodi-common-sr-only">{label}</span>
      <div aria-hidden="true" className="moodi-common-skeleton-visual">
        {variant === 'list' && <span className="moodi-common-skeleton-avatar" />}
        <div className="moodi-common-skeleton-lines">
          {Array.from({ length: normalizedLineCount }, (_, lineIndex) => (
            <span
              className="moodi-common-skeleton-line"
              key={`skeleton-line-${lineIndex + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

