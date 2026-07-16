import { useState, type KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'

type TagInputProps = {
  value: string[]
  onChange: (tags: string[]) => void
  label?: string
  maxTags?: number
}

/** 사용자 태그를 정규화해 추가하고 키보드로 삭제할 수 있는 입력 UI다. */
export function TagInput({
  value,
  onChange,
  label = '사용자 태그',
  maxTags = 8,
}: TagInputProps) {
  const [draftTag, setDraftTag] = useState('')

  const addTag = () => {
    const normalizedTag = draftTag.trim().replace(/^#/, '')

    if (!normalizedTag || value.includes(normalizedTag) || value.length >= maxTags) {
      setDraftTag('')
      return
    }

    onChange([...value, normalizedTag])
    setDraftTag('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag()
    }

    if (event.key === 'Backspace' && !draftTag && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div className="tag-input-field">
      <label htmlFor="diary-tag-input">{label}</label>
      <div className="tag-input-control">
        <div className="tag-input-values">
          {value.map((tag) => (
            <span className="editable-tag" key={tag}>
              #{tag}
              <button
                aria-label={`${tag} 태그 삭제`}
                onClick={() => onChange(value.filter((candidate) => candidate !== tag))}
                type="button"
              >
                <X aria-hidden="true" size={13} />
              </button>
            </span>
          ))}
        </div>
        <div className="tag-input-row">
          <input
            id="diary-tag-input"
            maxLength={24}
            onChange={(event) => setDraftTag(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={value.length >= maxTags ? '태그를 모두 추가했어요' : '태그 입력 후 Enter'}
            value={draftTag}
          />
          <button
            aria-label="태그 추가"
            disabled={!draftTag.trim() || value.length >= maxTags}
            onClick={addTag}
            type="button"
          >
            <Plus aria-hidden="true" size={17} />
          </button>
        </div>
      </div>
      <small>{value.length}/{maxTags}</small>
    </div>
  )
}
