import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './common.css'

export type ToastTone = 'success' | 'info' | 'error'

export type ToastProps = {
  message: string | null
  tone?: ToastTone
  onDismiss?: () => void
  dismissLabel?: string
}

const toastIcons: Record<ToastTone, LucideIcon> = {
  success: CheckCircle2,
  info: Info,
  error: AlertCircle,
}

/**
 * 저장 결과와 오류를 live region으로 알리는 공통 feedback UI다.
 */
export function Toast({
  message,
  tone = 'info',
  onDismiss,
  dismissLabel = '알림 닫기',
}: ToastProps) {
  const ToastIcon = toastIcons[tone]

  return (
    <div
      aria-atomic="true"
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className="moodi-common-toast-region"
    >
      {message && (
        <div
          className={`moodi-common-toast is-${tone}`}
          role={tone === 'error' ? 'alert' : 'status'}
        >
          <ToastIcon aria-hidden="true" size={19} />
          <span>{message}</span>
          {onDismiss && (
            <button aria-label={dismissLabel} onClick={onDismiss} type="button">
              <X aria-hidden="true" size={17} />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

