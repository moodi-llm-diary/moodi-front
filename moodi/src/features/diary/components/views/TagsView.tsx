import { Activity, BrainCircuit, Heart, Tag, X, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import type { DiaryEntry } from '../../types/diary'
import { DiaryListItem } from '../DiaryListItem'
import { EmptyState, PageHeader } from '../common'
import './views.css'

export type TagGroupCategory = 'user' | 'activity' | 'mood' | 'aiTopic'

export type TagGroupItemViewModel = {
  value: string
  label: string
  count: number
}

export type TagGroupViewModel = {
  category: TagGroupCategory
  label: string
  items: TagGroupItemViewModel[]
}

export type TagsViewProps = {
  groups: TagGroupViewModel[]
  selectedCategory?: TagGroupCategory
  selectedValue?: string
  selectedLabel?: string
  matchingEntries: DiaryEntry[]
  onSelect: (category: TagGroupCategory, value: string) => void
  onClear: () => void
  onOpenEntry: (entryId: string) => void
}

const categoryIcons: Record<TagGroupCategory, LucideIcon> = {
  user: Tag,
  activity: Activity,
  mood: Heart,
  aiTopic: BrainCircuit,
}

/** 한 번에 한 분류만 보여주며 태그 소유 경계를 유지하는 보조 탐색 화면이다. */
export function TagsView({
  groups,
  selectedCategory,
  selectedValue,
  selectedLabel,
  matchingEntries,
  onSelect,
  onClear,
  onOpenEntry,
}: TagsViewProps) {
  const [activeCategory, setActiveCategory] = useState<TagGroupCategory>(
    selectedCategory ?? groups.find((group) => group.items.length > 0)?.category ?? 'user',
  )
  const visibleCategory = selectedCategory ?? activeCategory
  const activeGroup = groups.find((group) => group.category === visibleCategory) ?? groups[0]
  const totalItemCount = groups.reduce((total, group) => total + group.items.length, 0)

  return (
    <div className="diary-view tags-view">
      <PageHeader
        description="기억에 남긴 단서 하나를 골라 다시 읽어보세요."
        eyebrow="기록 속 단서"
        title="태그와 주제"
      />

      {totalItemCount === 0 ? (
        <EmptyState
          description="기록에 감정이나 태그를 더하면 이곳에서 다시 만날 수 있어요."
          icon={<Tag size={26} />}
          title="아직 모인 단서가 없어요"
        />
      ) : (
        <>
          <div className="tag-category-tabs" aria-label="태그 분류">
            {groups.map((group) => {
              const CategoryIcon = categoryIcons[group.category]

              return (
                <button
                  aria-pressed={visibleCategory === group.category}
                  className={visibleCategory === group.category ? 'is-active' : undefined}
                  key={group.category}
                  onClick={() => {
                    setActiveCategory(group.category)
                    onClear()
                  }}
                  type="button"
                >
                  <CategoryIcon aria-hidden="true" size={17} />
                  {group.label}
                </button>
              )
            })}
          </div>

          <section className="tag-browser" aria-labelledby="tag-browser-title">
            <h2 id="tag-browser-title">{activeGroup?.label}</h2>
            {activeGroup && activeGroup.items.length > 0 ? (
              <div className="tag-item-list">
                {activeGroup.items.map((item) => (
                  <button
                    aria-pressed={
                      selectedCategory === activeGroup.category && selectedValue === item.value
                    }
                    className={
                      selectedCategory === activeGroup.category && selectedValue === item.value
                        ? 'is-selected'
                        : undefined
                    }
                    key={item.value}
                    onClick={() => onSelect(activeGroup.category, item.value)}
                    type="button"
                  >
                    <span>{item.label}</span>
                    <small>{item.count}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="view-muted-copy">이 분류에는 아직 단서가 없어요.</p>
            )}
          </section>
        </>
      )}

      {selectedLabel && (
        <section className="tag-matching-section" aria-labelledby="tag-matching-title">
          <header className="view-section-heading">
            <h2 id="tag-matching-title">“{selectedLabel}”이 담긴 기록</h2>
            <button className="view-text-button" onClick={onClear} type="button">
              <X aria-hidden="true" size={16} />
              선택 해제
            </button>
          </header>

          {matchingEntries.length > 0 ? (
            <div className="tag-matching-list">
              {matchingEntries.map((entry) => (
                <DiaryListItem compact entry={entry} key={entry.id} onOpen={onOpenEntry} />
              ))}
            </div>
          ) : (
            <EmptyState
              action={{ label: '선택 해제', onClick: onClear }}
              description="기록이 변경되었거나 현재 조건에서 찾을 수 없어요."
              title="연결된 기록이 없어요"
            />
          )}
        </section>
      )}
    </div>
  )
}
