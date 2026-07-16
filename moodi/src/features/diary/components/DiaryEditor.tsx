import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CloudSun,
  Heart,
  ImagePlus,
  LockKeyhole,
  MapPin,
  MoreHorizontal,
  Smile,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import type { DiaryImage, SaveDiaryDraftInput } from '../types/diary'
import { ActivitySelector } from './ActivitySelector'
import { EnergySelector } from './EnergySelector'
import { JournalPromptCard } from './JournalPromptCard'
import { MoodSelector } from './MoodSelector'
import { TagInput } from './TagInput'
import { BlockDiaryEditor } from './editor/BlockDiaryEditor'
import { getMoodVisual } from './diaryUiConfig'
import { getStandaloneDiaryImages } from '../services/diaryImageService'

type DiaryEditorProps = {
  value: SaveDiaryDraftInput
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'restored'
  errorMessage?: string
  isEditing: boolean
  isSaving: boolean
  prompt: string
  onBack: () => void
  onChange: <Key extends keyof SaveDiaryDraftInput>(
    field: Key,
    fieldValue: SaveDiaryDraftInput[Key],
  ) => void
  onDocumentChange: (content: string, contentHtml: string) => void
  onAddCoverImage: (file: File) => Promise<DiaryImage | null>
  onAddInlineImage: (file: File) => Promise<DiaryImage | null>
  onRemoveImage: (imageId: string) => void
  onSave: () => void
  onDiscardDraft: () => void
  onUsePrompt: (prompt: string) => void
  onRefreshPrompt: () => void
}

/** 제목과 본문을 중심으로 부가 맥락을 단계적으로 펼치는 일기 편집기다. */
export function DiaryEditor({
  value,
  autoSaveStatus,
  errorMessage,
  isEditing,
  isSaving,
  prompt,
  onBack,
  onChange,
  onDocumentChange,
  onAddCoverImage,
  onAddInlineImage,
  onRemoveImage,
  onSave,
  onDiscardDraft,
  onUsePrompt,
  onRefreshPrompt,
}: DiaryEditorProps) {
  const [isMetadataOpen, setIsMetadataOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<'mood' | 'tags' | null>(null)
  const [activeMetadataTool, setActiveMetadataTool] = useState<
    'date' | 'mood' | 'energy' | 'tags' | null
  >(null)
  const [imageRequestToken, setImageRequestToken] = useState(0)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const metadataTriggerRef = useRef<HTMLButtonElement | null>(null)
  const moodPanelRef = useRef<HTMLElement>(null)
  const standaloneImages = getStandaloneDiaryImages(value)
  const coverImage = standaloneImages[0]
  const legacyGalleryImages = standaloneImages.slice(1)

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine)

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (!activeMetadataTool) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      event.preventDefault()
      setActiveMetadataTool(null)
      window.requestAnimationFrame(() => metadataTriggerRef.current?.focus())
    }

    document.addEventListener('keydown', closeOnEscape)

    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [activeMetadataTool])

  const toggleMetadataTool = (
    tool: NonNullable<typeof activeMetadataTool>,
    trigger: HTMLButtonElement,
  ) => {
    metadataTriggerRef.current = trigger
    setActiveMetadataTool((current) => (current === tool ? null : tool))
  }

  const closeMetadataTool = () => {
    setActiveMetadataTool(null)
    window.requestAnimationFrame(() => metadataTriggerRef.current?.focus())
  }

  const openMobileMoodTool = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setActiveTool('mood')
    window.requestAnimationFrame(() => {
      moodPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  return (
    <section className="diary-editor">
      <header className="editor-toolbar">
        <button aria-label="이전 화면" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" size={20} />
        </button>

        <div className="editor-toolbar-context">
          <h1 className="sr-only">{isEditing ? '일기 수정하기' : '오늘의 일기 쓰기'}</h1>
          <label className="editor-toolbar-date">
            <span className="sr-only">기록 날짜</span>
            <input
              aria-label="기록 날짜"
              onChange={(event) => onChange('diaryDate', event.target.value)}
              type="date"
              value={value.diaryDate}
            />
          </label>
          <span className={`autosave-status status-${isOnline ? autoSaveStatus : 'offline'}`} role="status">
            {isOnline ? formatAutoSaveStatus(autoSaveStatus) : '오프라인 · 브라우저에 저장'}
          </span>
        </div>

        <div className="editor-toolbar-actions">
          <button
            aria-expanded={isMetadataOpen}
            aria-label={isMetadataOpen ? '기록 옵션 닫기' : '기록 옵션 열기'}
            className="icon-button"
            onClick={() => setIsMetadataOpen((current) => !current)}
            type="button"
          >
            <MoreHorizontal aria-hidden="true" size={21} />
          </button>
          <button className="primary-button" disabled={isSaving} onClick={onSave} type="button">
            <Check aria-hidden="true" size={18} />
            {isSaving ? '저장 중' : isEditing ? '수정 완료' : '완료'}
          </button>
        </div>
      </header>

      {errorMessage && (
        <p className="form-error" id="diary-editor-error" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="editor-paper" data-mood={value.mood ?? 'none'}>
        <input
          accept="image/*"
          aria-label="커버 이미지 추가"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]

            if (file) void onAddCoverImage(file)
            event.target.value = ''
          }}
          ref={coverInputRef}
          type="file"
        />
        {coverImage ? (
          <figure className="editor-cover-preview">
            <img alt={coverImage.alt ?? '일기 커버 이미지'} src={coverImage.url} />
            <button
              aria-label="커버 이미지 제거"
              onClick={() => onRemoveImage(coverImage.id)}
              type="button"
            >
              <Trash2 aria-hidden="true" size={17} />
            </button>
          </figure>
        ) : (
          <button
            className="editor-cover-add"
            onClick={() => coverInputRef.current?.click()}
            type="button"
          >
            <ImagePlus aria-hidden="true" size={16} />
            커버 추가
          </button>
        )}
        <div className="editor-page-accent" aria-hidden="true">
          {value.mood ? <span>{getMoodVisual(value.mood)?.shortLabel}</span> : <span>오늘</span>}
        </div>
        <label className="editor-title-field">
          <span className="sr-only">일기 제목</span>
          <input
            autoFocus
            maxLength={80}
            onChange={(event) => onChange('title', event.target.value)}
            placeholder="오늘을 한 문장으로 남긴다면"
            value={value.title}
          />
        </label>
        <div className="editor-document-meta-anchor">
          <div className="editor-document-meta" aria-label="기록 요약">
            <button
              aria-expanded={activeMetadataTool === 'date'}
              onClick={(event) => toggleMetadataTool('date', event.currentTarget)}
              type="button"
            >
              {formatEditorDate(value.diaryDate)}
            </button>
            <span aria-hidden="true">·</span>
            <button
              aria-expanded={activeMetadataTool === 'mood'}
              onClick={(event) => toggleMetadataTool('mood', event.currentTarget)}
              type="button"
            >
              {getMoodVisual(value.mood)?.label ?? '감정 추가'}
            </button>
            <span aria-hidden="true">·</span>
            <button
              aria-expanded={activeMetadataTool === 'energy'}
              onClick={(event) => toggleMetadataTool('energy', event.currentTarget)}
              type="button"
            >
              {value.energy ? `에너지 ${value.energy}` : '에너지 추가'}
            </button>
            <span aria-hidden="true">·</span>
            <button
              aria-expanded={activeMetadataTool === 'tags'}
              className="editor-document-tag"
              onClick={(event) => toggleMetadataTool('tags', event.currentTarget)}
              type="button"
            >
              {value.tags.length > 0
                ? value.tags.slice(0, 2).map((tag) => `#${tag}`).join(' ')
                : '#태그 추가'}
            </button>
          </div>

          {activeMetadataTool && (
            <section
              aria-label="기록 메타데이터 편집"
              className="editor-document-popover"
              role="dialog"
            >
              <header>
                <strong>{getMetadataToolLabel(activeMetadataTool)}</strong>
                <button aria-label="메타데이터 편집 닫기" onClick={closeMetadataTool} type="button">
                  <X aria-hidden="true" size={17} />
                </button>
              </header>
              {activeMetadataTool === 'date' && (
                <label className="editor-document-date-field">
                  <span><CalendarDays aria-hidden="true" size={16} /> 기록 날짜</span>
                  <input
                    onChange={(event) => onChange('diaryDate', event.target.value)}
                    type="date"
                    value={value.diaryDate}
                  />
                </label>
              )}
              {activeMetadataTool === 'mood' && (
                <MoodSelector
                  compact
                  onChange={(mood) => onChange('mood', mood)}
                  onClear={() => onChange('mood', undefined)}
                  value={value.mood}
                />
              )}
              {activeMetadataTool === 'energy' && (
                <EnergySelector
                  compact
                  onChange={(energy) => onChange('energy', energy)}
                  onClear={() => onChange('energy', undefined)}
                  value={value.energy}
                />
              )}
              {activeMetadataTool === 'tags' && (
                <TagInput onChange={(tags) => onChange('tags', tags)} value={value.tags} />
              )}
            </section>
          )}
        </div>
        <BlockDiaryEditor
          contentHtml={value.contentHtml ?? ''}
          errorMessage={errorMessage}
          imageRequestToken={imageRequestToken}
          onChange={onDocumentChange}
          onInsertImage={onAddInlineImage}
          onOpenMood={openMobileMoodTool}
          plainText={value.content}
        />

        {legacyGalleryImages.length > 0 && (
          <div className="editor-image-grid">
            {legacyGalleryImages.map((image: DiaryImage) => (
              <figure key={image.id}>
                <img alt={image.alt ?? '일기 첨부 미리보기'} src={image.url} />
                <button
                  aria-label={`${image.alt ?? '첨부 사진'} 삭제`}
                  onClick={() => onRemoveImage(image.id)}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} />
                </button>
              </figure>
            ))}
          </div>
        )}
      </div>

      <div className="editor-soft-tools" role="group" aria-label="기록에 바로 더하기">
        <button
          aria-pressed={activeTool === 'mood'}
          className={activeTool === 'mood' || value.mood ? 'is-active' : undefined}
          onClick={() => setActiveTool((current) => (current === 'mood' ? null : 'mood'))}
          type="button"
        >
          <Smile aria-hidden="true" size={18} />
          <span>{value.mood ? '감정 바꾸기' : '감정'}</span>
        </button>
        <button
          className="editor-soft-tool editor-photo-tool"
          onClick={() => setImageRequestToken((token) => token + 1)}
          type="button"
        >
          <ImagePlus aria-hidden="true" size={18} />
          <span>{value.images.length > 0 ? `사진 ${value.images.length}` : '사진'}</span>
        </button>
        <button
          aria-pressed={activeTool === 'tags'}
          className={activeTool === 'tags' || value.tags.length > 0 ? 'is-active' : undefined}
          onClick={() => setActiveTool((current) => (current === 'tags' ? null : 'tags'))}
          type="button"
        >
          <Tag aria-hidden="true" size={18} />
          <span>{value.tags.length > 0 ? `태그 ${value.tags.length}` : '태그'}</span>
        </button>
        <button
          aria-pressed={value.isLocked}
          className={value.isLocked ? 'is-active' : undefined}
          onClick={() => onChange('isLocked', !value.isLocked)}
          type="button"
        >
          <LockKeyhole aria-hidden="true" size={18} />
          <span>{value.isLocked ? '잠금 표시됨' : '잠금'}</span>
        </button>
      </div>

      {activeTool === 'mood' && (
        <section
          aria-label="감정과 에너지 선택"
          className="editor-inline-tool-panel"
          ref={moodPanelRef}
        >
          <MoodSelector
            compact
            onChange={(mood) => onChange('mood', mood)}
            onClear={() => onChange('mood', undefined)}
            value={value.mood}
          />
          <EnergySelector
            compact
            onChange={(energy) => onChange('energy', energy)}
            onClear={() => onChange('energy', undefined)}
            value={value.energy}
          />
        </section>
      )}

      {activeTool === 'tags' && (
        <section className="editor-inline-tool-panel" aria-label="기록 태그 추가">
          <TagInput onChange={(tags) => onChange('tags', tags)} value={value.tags} />
        </section>
      )}

      {value.isLocked && (
        <p className="editor-lock-note">잠금은 현재 앱 안의 표시이며 암호화 기능은 아닙니다.</p>
      )}

      <JournalPromptCard onRefresh={onRefreshPrompt} onUse={onUsePrompt} prompt={prompt} />

      {isMetadataOpen && (
        <section className="editor-metadata" aria-label="기록에 더할 정보">
          <header>
            <div>
              <span>기록에 더하기</span>
              <p>남기고 싶은 정보만 골라서 펼쳐보세요.</p>
            </div>
          </header>

          <details>
            <summary>오늘의 활동</summary>
            <div className="editor-disclosure-content">
              <ActivitySelector
                onChange={(activities) => onChange('activities', activities)}
                value={value.activities}
              />
            </div>
          </details>

          <details>
            <summary>날씨와 장소</summary>
            <div className="editor-disclosure-content">
              <div className="context-input-grid">
                <label>
                  <span><CloudSun aria-hidden="true" size={16} /> 날씨</span>
                  <input
                    onChange={(event) =>
                      onChange('weather', {
                        ...value.weather,
                        condition: event.target.value || undefined,
                      })
                    }
                    placeholder="예: 맑음"
                    value={value.weather?.condition ?? ''}
                  />
                </label>
                <label>
                  <span><MapPin aria-hidden="true" size={16} /> 장소</span>
                  <input
                    onChange={(event) =>
                      onChange('location', { name: event.target.value || undefined })
                    }
                    placeholder="직접 입력"
                    value={value.location?.name ?? ''}
                  />
                </label>
              </div>
            </div>
          </details>

          <details>
            <summary>즐겨찾기</summary>
            <div className="editor-disclosure-content">
              <div className="editor-toggle-row">
                <button
                  aria-pressed={value.isFavorite}
                  className={value.isFavorite ? 'active' : ''}
                  onClick={() => onChange('isFavorite', !value.isFavorite)}
                  type="button"
                >
                  <Heart aria-hidden="true" fill={value.isFavorite ? 'currentColor' : 'none'} size={17} />
                  즐겨찾기
                </button>
              </div>
            </div>
          </details>

          <button className="ghost-button danger-text" onClick={onDiscardDraft} type="button">
            <Trash2 aria-hidden="true" size={16} />
            임시저장 비우기
          </button>
        </section>
      )}
    </section>
  )
}

function formatAutoSaveStatus(status: DiaryEditorProps['autoSaveStatus']): string {
  const labels: Record<DiaryEditorProps['autoSaveStatus'], string> = {
    idle: '저장됨',
    saving: '저장 중…',
    saved: '저장됨',
    error: '저장 실패',
    restored: '복구됨',
  }

  return labels[status]
}

function formatEditorDate(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`)

  return Number.isNaN(date.getTime())
    ? dateKey
    : new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(date)
}

function getMetadataToolLabel(
  tool: 'date' | 'mood' | 'energy' | 'tags',
): string {
  const labels = {
    date: '날짜',
    mood: '감정',
    energy: '에너지',
    tags: '태그',
  }

  return labels[tool]
}
