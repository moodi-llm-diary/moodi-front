import { useEffect, useRef } from 'react'
import { Check, X } from 'lucide-react'
import type { DailyCheckIn } from '../types/diary'
import { ActivitySelector } from './ActivitySelector'
import { EnergySelector } from './EnergySelector'
import { MoodSelector } from './MoodSelector'

type QuickCheckInProps = {
  isOpen: boolean
  value: DailyCheckIn
  isSaving: boolean
  onChange: <Key extends keyof DailyCheckIn>(
    field: Key,
    fieldValue: DailyCheckIn[Key],
  ) => void
  onClose: () => void
  onSave: () => void
}

const focusableSelector =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/** 감정과 에너지, 한 줄을 먼저 받고 활동은 선택적으로 펼치는 빠른 기록 dialog다. */
export function QuickCheckIn({
  isOpen,
  value,
  isSaving,
  onChange,
  onClose,
  onSave,
}: QuickCheckInProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const isSavingRef = useRef(isSaving)

  useEffect(() => {
    isSavingRef.current = isSaving

    const dialog = dialogRef.current

    if (!isOpen || !isSaving || !dialog) return

    const frameId = window.requestAnimationFrame(() => {
      if (!dialog.contains(document.activeElement)) {
        getFocusableElements(dialog)[0]?.focus()
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [isOpen, isSaving])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSavingRef.current) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) {
        return
      }

      const focusableElements = getFocusableElements(dialogRef.current)
      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)
      const activeElement = document.activeElement

      if (!focusableElements.includes(activeElement as HTMLElement)) {
        event.preventDefault()
        const nextElement = event.shiftKey ? lastElement : firstElement
        nextElement?.focus()
        return
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement?.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      previouslyFocusedRef.current?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) {
    return null
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => !isSaving && event.target === event.currentTarget && onClose()}
    >
      <div
        aria-busy={isSaving || undefined}
        aria-describedby="quick-check-description"
        aria-labelledby="quick-check-title"
        aria-modal="true"
        className="quick-check-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <div>
            <h2 id="quick-check-title">지금 기분은 어때?</h2>
            <p className="sr-only" id="quick-check-description">감정과 에너지를 짧게 기록합니다.</p>
          </div>
          <button aria-label="빠른 기록 닫기" className="icon-button" disabled={isSaving} onClick={onClose} ref={closeButtonRef} type="button">
            <X aria-hidden="true" size={19} />
          </button>
        </header>

        <div className="quick-check-content">
          <MoodSelector compact onChange={(mood) => onChange('mood', mood)} value={value.mood} />
          <EnergySelector compact onChange={(energy) => onChange('energy', energy)} value={value.energy} />
          <label className="quick-note-field">
            <span>짧게 남기기</span>
            <textarea
              maxLength={180}
              onChange={(event) => onChange('shortNote', event.target.value)}
              placeholder="지금 떠오르는 한 문장"
              value={value.shortNote ?? ''}
            />
            <small>{value.shortNote?.length ?? 0}/180</small>
          </label>
          <details className="quick-activity-disclosure">
            <summary>무엇을 했는지 추가하기</summary>
            <ActivitySelector
              compact
              onChange={(activities) => onChange('activities', activities)}
              value={value.activities}
            />
          </details>
        </div>

        <footer>
          <button className="primary-button" disabled={!value.mood || isSaving} onClick={onSave} type="button">
            <Check aria-hidden="true" size={18} />
            {isSaving ? '기록 중' : '기록하기'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function getFocusableElements(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(focusableSelector),
  ).filter((element) => {
    const closedDetails = element.closest<HTMLDetailsElement>('details:not([open])')

    return !closedDetails || closedDetails.querySelector('summary') === element
  })
}
