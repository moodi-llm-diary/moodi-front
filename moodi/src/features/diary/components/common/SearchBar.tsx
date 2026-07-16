import { Search, X } from 'lucide-react'
import { useId, type FormEvent } from 'react'
import './common.css'

export type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  onSubmit?: (value: string) => void
  onClear?: () => void
  label?: string
  placeholder?: string
  inputId?: string
  autoFocus?: boolean
}

/**
 * 검색어 입력과 지우기 event만 전달하는 compact search control이다.
 */
export function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  label = '기록 검색',
  placeholder = '제목, 본문, 태그로 검색',
  inputId,
  autoFocus = false,
}: SearchBarProps) {
  const generatedInputId = useId()
  const resolvedInputId = inputId ?? generatedInputId

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit?.(value)
  }

  return (
    <form className="moodi-common-search" onSubmit={submitSearch} role="search">
      <label className="moodi-common-sr-only" htmlFor={resolvedInputId}>
        {label}
      </label>
      <Search aria-hidden="true" className="moodi-common-search-icon" size={19} />
      <input
        autoFocus={autoFocus}
        id={resolvedInputId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
        value={value}
      />
      {value && (
        <button
          aria-label={`${label} 내용 지우기`}
          className="moodi-common-search-clear"
          onClick={() => (onClear ? onClear() : onChange(''))}
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      )}
    </form>
  )
}

