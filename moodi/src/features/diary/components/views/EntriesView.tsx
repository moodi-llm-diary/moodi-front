import { ListFilter, PenLine, RotateCcw, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import type { DiaryEntry, DiaryEntryFilters } from '../../types/diary'
import { DiaryListItem } from '../DiaryListItem'
import { FilterPopover } from '../FilterPopover'
import { EmptyState, PageHeader, SearchBar } from '../common'
import './views.css'

export type EntriesViewProps = {
  entries: DiaryEntry[]
  filters: DiaryEntryFilters
  isFilterOpen: boolean
  availableTags: string[]
  activeFilterCount: number
  onSearchChange: (query: string) => void
  onFiltersChange: (filters: DiaryEntryFilters) => void
  onClearFilters: () => void
  onToggleFilter: () => void
  onOpenEntry: (entryId: string) => void
  onWrite: () => void
}

/** 전체 기록을 날짜 중심의 한 가지 timeline으로 표시한다. */
export function EntriesView({
  entries,
  filters,
  isFilterOpen,
  availableTags,
  activeFilterCount,
  onSearchChange,
  onFiltersChange,
  onClearFilters,
  onToggleFilter,
  onOpenEntry,
  onWrite,
}: EntriesViewProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(Boolean(filters.query?.trim()))
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const hasSearchOrFilter = Boolean(filters.query?.trim()) || activeFilterCount > 0
  const dateGroups = groupEntriesByDate(entries)

  return (
    <div className="diary-view entries-view">
      <PageHeader
        actions={
          <button className="view-primary-button" onClick={onWrite} type="button">
            <PenLine aria-hidden="true" size={17} />
            새 기록
          </button>
        }
        description="날짜를 따라 천천히 지난 마음을 꺼내보세요."
        eyebrow="나의 기록"
        title="기록"
      />

      <div className="entries-toolbar">
        <div className="entries-toolbar-actions">
          <button
            aria-expanded={isSearchOpen}
            className={filters.query?.trim() ? 'is-active' : undefined}
            onClick={() => setIsSearchOpen((currentValue) => !currentValue)}
            type="button"
          >
            <Search aria-hidden="true" size={17} />
            검색
          </button>
          <button
            aria-expanded={isFilterOpen}
            className={`entries-filter-button ${activeFilterCount > 0 ? 'is-active' : ''}`}
            onClick={onToggleFilter}
            ref={filterButtonRef}
            type="button"
          >
            <ListFilter aria-hidden="true" size={17} />
            필터
            {activeFilterCount > 0 && (
              <span aria-label={`적용된 필터 ${activeFilterCount}개`}>{activeFilterCount}</span>
            )}
          </button>
          {hasSearchOrFilter && (
            <button className="entries-clear-button" onClick={onClearFilters} type="button">
              <RotateCcw aria-hidden="true" size={15} />
              조건 지우기
            </button>
          )}
        </div>
      </div>

      {isSearchOpen && (
        <div className="entries-search-disclosure">
          <SearchBar
            autoFocus
            label="전체 기록 검색"
            onChange={onSearchChange}
            placeholder="제목이나 본문에서 찾기"
            value={filters.query ?? ''}
          />
        </div>
      )}

      <div className="entries-filter-anchor">
        <FilterPopover
          availableTags={availableTags}
          filters={filters}
          isOpen={isFilterOpen}
          onChange={onFiltersChange}
          onClear={onClearFilters}
          onClose={onToggleFilter}
          triggerRef={filterButtonRef}
        />
      </div>

      {hasSearchOrFilter && (
        <p className="entries-result-note" aria-live="polite">
          조건에 맞는 기록 {entries.length}개
        </p>
      )}

      {entries.length === 0 ? (
        <EmptyState
          action={
            hasSearchOrFilter
              ? { label: '검색과 필터 지우기', onClick: onClearFilters }
              : { label: '첫 기록 남기기', onClick: onWrite }
          }
          description={
            hasSearchOrFilter
              ? '조건을 줄이거나 다른 검색어를 입력해 보세요.'
              : '오늘의 한 문장부터 이곳에 차곡차곡 쌓여요.'
          }
          title={hasSearchOrFilter ? '찾는 기록이 없어요' : '아직 기록이 없어요'}
        />
      ) : (
        <div className="entries-results is-timeline">
          <div className="entries-date-groups">
            {dateGroups.map((group) => {
              const headingId = `entries-date-${group.dateKey}`

              return (
                <section
                  aria-labelledby={headingId}
                  className="entries-date-group"
                  key={group.dateKey}
                >
                  <h2 id={headingId}>{formatDateGroupLabel(group.dateKey)}</h2>
                  <div>
                    {group.entries.map((entry) => (
                      <DiaryListItem entry={entry} key={entry.id} onOpen={onOpenEntry} />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function groupEntriesByDate(entries: DiaryEntry[]): Array<{
  dateKey: string
  entries: DiaryEntry[]
}> {
  const groups = new Map<string, DiaryEntry[]>()

  entries.forEach((entry) => {
    const dateEntries = groups.get(entry.diaryDate) ?? []

    dateEntries.push(entry)
    groups.set(entry.diaryDate, dateEntries)
  })

  return Array.from(groups, ([dateKey, dateEntries]) => ({
    dateKey,
    entries: dateEntries,
  }))
}

function formatDateGroupLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`)

  if (Number.isNaN(date.getTime())) return dateKey

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
}
