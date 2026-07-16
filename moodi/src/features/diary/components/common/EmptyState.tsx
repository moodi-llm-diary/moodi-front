import { BookHeart } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import './common.css'

export type EmptyStateAction = {
  label: string
  onClick: () => void
}

export type EmptyStateProps = {
  title: string
  description?: ReactNode
  icon?: ReactNode
  action?: EmptyStateAction
  secondaryAction?: EmptyStateAction
}

/**
 * 데이터가 없는 이유와 다음에 할 수 있는 동작을 함께 안내한다.
 */
export function EmptyState({
  title,
  description,
  icon = <BookHeart size={26} />,
  action,
  secondaryAction,
}: EmptyStateProps) {
  const titleId = useId()

  return (
    <section className="moodi-common-empty-state" aria-labelledby={titleId}>
      <span className="moodi-common-empty-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="moodi-common-empty-copy">
        <h2 id={titleId}>{title}</h2>
        {description && <div>{description}</div>}
      </div>
      {(action || secondaryAction) && (
        <div className="moodi-common-empty-actions">
          {action && (
            <button className="moodi-common-button is-primary" onClick={action.onClick} type="button">
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              className="moodi-common-button is-secondary"
              onClick={secondaryAction.onClick}
              type="button"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

