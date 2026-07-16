import { useId, type ReactNode } from 'react'
import './common.css'

export type PageHeaderProps = {
  title: string
  eyebrow?: string
  description?: ReactNode
  leading?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}

/**
 * 각 route의 제목, 설명, page-level action을 일관된 위계로 표시한다.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  leading,
  actions,
  meta,
}: PageHeaderProps) {
  const titleId = useId()

  return (
    <header className="moodi-common-page-header" aria-labelledby={titleId}>
      <div className="moodi-common-page-header-copy">
        {leading && <div className="moodi-common-page-header-leading">{leading}</div>}
        <div>
          {eyebrow && <span className="moodi-common-page-eyebrow">{eyebrow}</span>}
          <h1 id={titleId}>{title}</h1>
          {description && <div className="moodi-common-page-description">{description}</div>}
          {meta && <div className="moodi-common-page-meta">{meta}</div>}
        </div>
      </div>
      {actions && <div className="moodi-common-page-actions">{actions}</div>}
    </header>
  )
}

