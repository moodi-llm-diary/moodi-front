import { AlertTriangle } from 'lucide-react'
import { useEffect, useId, useRef, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import './common.css'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export type ConfirmDialogProps = {
  isOpen: boolean
  title: string
  description: ReactNode
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'default'
  isPending?: boolean
}

/**
 * 파괴적이거나 되돌리기 어려운 동작을 확인하는 접근 가능한 dialog다.
 */
export function ConfirmDialog({
  isOpen,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = '확인',
  cancelLabel = '취소',
  tone = 'danger',
  isPending = false,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const cancelHandlerRef = useRef(onCancel)
  const pendingRef = useRef(isPending)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    cancelHandlerRef.current = onCancel
  }, [onCancel])

  useEffect(() => {
    pendingRef.current = isPending
  }, [isPending])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousBodyOverflow = document.body.style.overflow
    const focusFrame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus())

    document.body.style.overflow = 'hidden'

    const keepFocusInsideDialog = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!pendingRef.current) cancelHandlerRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true')

      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const firstFocusableElement = focusableElements[0]
      const lastFocusableElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (!dialogRef.current.contains(activeElement)) {
        event.preventDefault()
        const focusTarget = event.shiftKey ? lastFocusableElement : firstFocusableElement

        focusTarget?.focus()
      } else if (event.shiftKey && activeElement === firstFocusableElement) {
        event.preventDefault()
        lastFocusableElement?.focus()
      } else if (!event.shiftKey && activeElement === lastFocusableElement) {
        event.preventDefault()
        firstFocusableElement?.focus()
      }
    }

    document.addEventListener('keydown', keepFocusInsideDialog)

    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', keepFocusInsideDialog)
      document.body.style.overflow = previousBodyOverflow

      if (previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus()
      }
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  const closeFromBackdrop = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isPending && event.target === event.currentTarget) {
      onCancel()
    }
  }

  return (
    <div className="moodi-common-dialog-backdrop" onMouseDown={closeFromBackdrop}>
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="moodi-common-confirm-dialog"
        ref={dialogRef}
        role="alertdialog"
        tabIndex={-1}
      >
        <span className={`moodi-common-dialog-icon is-${tone}`} aria-hidden="true">
          <AlertTriangle size={23} />
        </span>
        <div className="moodi-common-dialog-copy">
          <h2 id={titleId}>{title}</h2>
          <div id={descriptionId}>{description}</div>
        </div>
        <div className="moodi-common-dialog-actions">
          <button
            className="moodi-common-button is-secondary"
            disabled={isPending}
            onClick={onCancel}
            ref={cancelButtonRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            aria-busy={isPending || undefined}
            className={`moodi-common-button ${tone === 'danger' ? 'is-danger' : 'is-primary'}`}
            disabled={isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? '처리 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
