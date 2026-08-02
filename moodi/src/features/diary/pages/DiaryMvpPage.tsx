import { lazy, Suspense, type ReactNode } from 'react'
import { AlertCircle, LoaderCircle } from 'lucide-react'
import { SettingsPage } from '../../settings/pages/SettingsPage'
import type { ThemeName, ThemeOption } from '../../theme/types/theme'
import {
  AppShell,
  ConfirmDialog,
  EmptyState,
  Skeleton,
  Toast,
} from '../components/common'
import { QuickCheckIn } from '../components/QuickCheckIn'
import {
  CalendarWorkspaceView,
  AIChatView,
  EntriesView,
  EntryDetailView,
  InsightsView,
  TagsView,
  TodayView,
} from '../components/views'
import { useDiaryWorkspace } from '../hooks/useDiaryWorkspace'
import './DiaryMvpPage.css'

const WriteWorkspaceView = lazy(async () => {
  const module = await import('../components/views/WriteWorkspaceView')

  return { default: module.WriteWorkspaceView }
})

type DiaryMvpPageProps = {
  activeTheme: ThemeName
  authUserLabel?: string
  onOpenLogin: () => void
  onOpenMyPage: () => void
  onSelectTheme: (themeName: ThemeName) => boolean
  themeOptions: ThemeOption[]
}

/** Moodi route 화면과 AppShell만 조립하는 Presentation 경계다. */
export function DiaryMvpPage({
  activeTheme,
  authUserLabel,
  onOpenLogin,
  onOpenMyPage,
  onSelectTheme,
  themeOptions,
}: DiaryMvpPageProps) {
  const workspace = useDiaryWorkspace()
  const profileAction = authUserLabel ? onOpenMyPage : onOpenLogin
  const confirmationCopy = getConfirmationCopy(workspace.confirmation)

  return (
    <AppShell
      activeRoute={workspace.activeRoute}
      favoriteEntries={workspace.sortedEntries
        .filter((entry) => entry.isFavorite)
        .slice(0, 3)
        .map((entry) => ({
          id: entry.id,
          title: entry.title || (entry.type === 'quick' ? '빠른 기록' : '제목 없는 기록'),
          meta: formatSidebarEntryDate(entry.diaryDate),
        }))}
      mobileTitle={workspace.location.name === 'calendar' ? workspace.calendarTitle : undefined}
      onCreateAIConversation={() => void workspace.journalAI.createConversation()}
      onMoveCalendarToToday={workspace.moveCalendarToToday}
      onNavigate={workspace.navigateFromShell}
      onOpenRecentEntry={workspace.openEntry}
      onOpenProfile={profileAction}
      onResumeDraft={() => workspace.navigateTo({ name: 'write' })}
      onStartNewJournal={() => void workspace.requestStartNewJournal()}
      profile={{
        displayName: authUserLabel ?? '게스트 기록자',
        secondaryText: authUserLabel ? '나의 기록 보기' : '로그인하고 기억 이어가기',
      }}
      draftTitle={workspace.draft?.title || (workspace.draft ? '제목 없는 초안' : undefined)}
      recentEntries={workspace.sortedEntries.slice(0, 5).map((entry) => ({
        id: entry.id,
        title: entry.title || (entry.type === 'quick' ? '빠른 기록' : '제목 없는 기록'),
        meta: formatSidebarEntryDate(entry.diaryDate),
      }))}
    >
      {workspace.status === 'loading' || workspace.status === 'idle' ? (
        <div className="workspace-loading" aria-label="Moodi 기록 불러오는 중">
          <LoaderCircle aria-hidden="true" className="spin" size={22} />
          <Skeleton lines={5} variant="list" />
        </div>
      ) : workspace.status === 'error' ? (
        <EmptyState
          action={{ label: '다시 불러오기', onClick: () => void workspace.retryInitialize() }}
          description={workspace.storeErrorMessage ?? '브라우저 저장소를 확인해 주세요.'}
          icon={<AlertCircle size={26} />}
          secondaryAction={{
            label: '손상된 로컬 데이터 초기화',
            onClick: workspace.requestStorageRecovery,
          }}
          title="기록을 불러오지 못했어요"
        />
      ) : (
        renderActiveView(workspace, {
          activeTheme,
          themeOptions,
          onSelectTheme,
          onOpenProfile: profileAction,
        })
      )}

      <QuickCheckIn
        isOpen={workspace.quickCheckIn.isOpen}
        isSaving={workspace.quickCheckIn.isSaving}
        onChange={workspace.quickCheckIn.updateField}
        onClose={workspace.quickCheckIn.close}
        onSave={workspace.quickCheckIn.save}
        value={workspace.quickCheckIn.value}
      />

      <ConfirmDialog
        confirmLabel={confirmationCopy.confirmLabel}
        description={confirmationCopy.description}
        isOpen={workspace.confirmation !== null}
        isPending={workspace.mutationStatus !== 'idle'}
        onCancel={workspace.cancelConfirmation}
        onConfirm={() => void workspace.confirmPendingAction()}
        title={confirmationCopy.title}
        tone="danger"
      />

      <Toast
        message={workspace.toast.message ?? workspace.initializationWarning}
        onDismiss={() => {
          if (workspace.toast.message) {
            workspace.setToast((current) => ({ ...current, message: null }))
            return
          }

          workspace.clearInitializationWarning()
        }}
        tone={workspace.toast.message ? workspace.toast.tone : 'error'}
      />
    </AppShell>
  )
}

function formatSidebarEntryDate(diaryDate: string): string {
  const date = new Date(`${diaryDate}T00:00:00`)

  if (Number.isNaN(date.getTime())) return diaryDate

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

type Workspace = ReturnType<typeof useDiaryWorkspace>

function renderActiveView(
  workspace: Workspace,
  settingsProps: {
    activeTheme: ThemeName
    themeOptions: ThemeOption[]
    onSelectTheme: (themeName: ThemeName) => boolean
    onOpenProfile: () => void
  },
): ReactNode {
  switch (workspace.location.name) {
    case 'home':
      return (
        <TodayView
          dailySentence={workspace.dailySentence}
          draft={workspace.draft}
          entries={workspace.sortedEntries}
          onOpenEntries={() => workspace.navigateTo({ name: 'entries' })}
          onOpenEntry={workspace.openEntry}
          onOpenInsights={() => workspace.navigateTo({ name: 'insights' })}
          onOpenQuick={workspace.quickCheckIn.open}
          onSelectMood={workspace.quickCheckIn.openWithMood}
          onResumeDraft={() => workspace.navigateTo({ name: 'write' })}
          onStartFromQuestion={(question) => void workspace.startWritingFromPrompt(question)}
          onStartJournal={() => void workspace.requestStartNewJournal()}
          onThisDayEntries={workspace.onThisDayEntries}
          question={workspace.currentPrompt}
          todayEntries={workspace.todayEntries}
        />
      )
    case 'write':
      return (
        <Suspense fallback={<p className="editor-loading" role="status">에디터를 준비하고 있어요…</p>}>
          <WriteWorkspaceView
            autoSaveStatus={workspace.editor.autoSaveStatus}
            errorMessage={workspace.editor.errorMessage}
            isEditing={workspace.editor.isEditing}
            isSaving={workspace.editor.isSaving}
            onAddCoverImage={workspace.editor.addCoverImage}
            onAddInlineImage={workspace.editor.addInlineImage}
            onBack={workspace.goBack}
            onChange={workspace.editor.updateField}
            onDocumentChange={workspace.editor.updateDocument}
            onDiscardDraft={workspace.editor.discardDraft}
            onRemoveImage={workspace.editor.removeImage}
            onSave={workspace.editor.saveEditor}
            onRefreshPrompt={workspace.refreshPrompt}
            onUsePrompt={workspace.editor.appendPrompt}
            prompt={workspace.currentPrompt}
            value={workspace.editor.value}
          />
        </Suspense>
      )
    case 'ai':
      return (
        <AIChatView
          activeConversation={workspace.journalAI.activeConversation}
          activeConversationId={workspace.journalAI.activeConversationId}
          conversations={workspace.journalAI.conversations}
          errorCode={workspace.journalAI.errorCode}
          errorMessage={workspace.journalAI.errorMessage}
          isConversationMutating={workspace.journalAI.isConversationMutating}
          pendingAssistantContent={workspace.journalAI.pendingAssistantContent}
          onCancel={workspace.journalAI.cancelMessage}
          onCreateConversation={workspace.journalAI.createConversation}
          onDeleteConversation={workspace.journalAI.deleteConversation}
          onOpenConversation={workspace.journalAI.openConversation}
          onOpenEntry={(entryId) => {
            const sourceEntry = workspace.entries.find(
              (entry) =>
                entry.id === entryId &&
                !entry.isLocked &&
                !entry.id.startsWith('seed-'),
            )

            if (sourceEntry) workspace.openEntry(entryId)
            else workspace.journalAI.reportSourceLoadFailure()
          }}
          onOpenInsights={() => workspace.navigateTo({ name: 'insights' })}
          onRenameConversation={workspace.journalAI.renameConversation}
          onRetry={workspace.journalAI.retry}
          onResetConversationStorage={workspace.journalAI.resetConversationStorage}
          onSendMessage={workspace.journalAI.sendMessage}
          phase={workspace.journalAI.phase}
          statusMessage={workspace.journalAI.statusMessage}
          suggestedQuestions={workspace.journalAI.suggestedQuestions}
        />
      )
    case 'entries':
      return (
        <EntriesView
          activeFilterCount={workspace.activeFilterCount}
          availableTags={workspace.availableTags}
          entries={workspace.filteredEntries}
          filters={workspace.filters}
          isFilterOpen={workspace.isFilterOpen}
          onClearFilters={workspace.clearFilters}
          onFiltersChange={workspace.setFilters}
          onOpenEntry={workspace.openEntry}
          onSearchChange={(query) => workspace.setFilters({ ...workspace.filters, query })}
          onToggleFilter={workspace.toggleFilter}
          onWrite={() => void workspace.requestStartNewJournal()}
        />
      )
    case 'entryDetail':
      return (
        <EntryDetailView
          entry={workspace.currentEntry ?? null}
          isAIExpanded={workspace.isAiInsightExpanded}
          nextEntry={workspace.nextEntry}
          onBack={workspace.goBack}
          onDelete={(entryId) => {
            const entry = workspace.entries.find((candidate) => candidate.id === entryId)
            if (entry) workspace.requestEntryDelete(entry)
          }}
          onEdit={workspace.editEntry}
          onOpenEntry={workspace.openEntry}
          onToggleAI={() =>
            workspace.setIsAiInsightExpanded(!workspace.isAiInsightExpanded)
          }
          onToggleFavorite={(entryId, isFavorite) =>
            void workspace.toggleFavorite(entryId, isFavorite)
          }
          previousEntry={workspace.previousEntry}
          relatedEntries={workspace.relatedEntries}
        />
      )
    case 'calendar':
      return (
        <CalendarWorkspaceView
          calendarDays={workspace.calendarDays}
          calendarTitle={workspace.calendarTitle}
          moodFilter={
            workspace.calendarMoodFilter === 'all'
              ? undefined
              : workspace.calendarMoodFilter
          }
          onMoodFilterChange={(mood) => workspace.setCalendarMoodFilter(mood ?? 'all')}
          onMoveMonth={workspace.moveCalendarMonth}
          onMoveToToday={workspace.moveCalendarToToday}
          onOpenEntry={workspace.openEntry}
          onSelectDate={workspace.selectCalendarDate}
          onTagFilterChange={(tag) => workspace.setCalendarTagFilter(tag ?? 'all')}
          onWriteSelectedDate={() => void workspace.writeSelectedDate()}
          selectedDate={workspace.selectedDate}
          selectedDateEntries={workspace.selectedDateEntries}
          tagFilter={
            workspace.calendarTagFilter === 'all'
              ? undefined
              : workspace.calendarTagFilter
          }
          tagOptions={Array.from(
            new Set([...workspace.availableTags, ...workspace.availableAiTopics]),
          )}
          weekdayLabels={['월', '화', '수', '목', '금', '토', '일']}
        />
      )
    case 'insights':
      return (
        <InsightsView
          insights={workspace.insights}
          onOpenEntry={workspace.openEntry}
          onStartWriting={() => void workspace.requestStartNewJournal()}
          reflectionEntries={workspace.reflectionEntries}
          reflectionThemes={workspace.reflectionThemes}
          reflectionThought={workspace.reflectionThought}
        />
      )
    case 'tags':
      return (
        <TagsView
          groups={workspace.tagGroups}
          matchingEntries={workspace.tagMatchingEntries}
          onClear={() => workspace.setSelectedTag(null)}
          onOpenEntry={workspace.openEntry}
          onSelect={(category, value) => workspace.setSelectedTag({ category, value })}
          selectedCategory={workspace.selectedTag?.category}
          selectedLabel={workspace.selectedTagLabel}
          selectedValue={workspace.selectedTag?.value}
        />
      )
    case 'settings':
      return (
        <SettingsPage
          activeTheme={settingsProps.activeTheme}
          onDeleteAll={() => workspace.requestDeleteAll()}
          onExport={workspace.exportEntries}
          onImportFile={workspace.requestImport}
          onOpenTags={() => workspace.navigateTo({ name: 'tags' })}
          onOpenProfile={settingsProps.onOpenProfile}
          onSelectTheme={settingsProps.onSelectTheme}
          onToast={(message, tone = 'success') => workspace.showToast(message, tone)}
          themeOptions={settingsProps.themeOptions}
        />
      )
  }
}

function getConfirmationCopy(confirmation: Workspace['confirmation']) {
  if (!confirmation) {
    return {
      title: '요청을 확인해 주세요',
      description: '이 작업을 계속할까요?',
      confirmLabel: '확인',
    }
  }

  if (confirmation.kind === 'entry') {
    return {
      title: '이 기록을 삭제할까요?',
      description: `“${confirmation.title}” 기록은 삭제 후 복구할 수 없습니다.`,
      confirmLabel: '기록 삭제',
    }
  }

  if (confirmation.kind === 'edit') {
    return {
      title: '다른 기록을 수정할까요?',
      description: `현재 임시저장을 비우고 “${confirmation.title}” 기록을 엽니다. 이어 쓰려면 취소해 주세요.`,
      confirmLabel: '임시저장 비우고 수정',
    }
  }

  if (confirmation.kind === 'import') {
    return {
      title: '가져온 기록으로 교체할까요?',
      description: `${confirmation.entries.length}개의 기록으로 현재 목록을 교체하고 임시저장도 비웁니다. 먼저 내보내기를 권장해요.`,
      confirmLabel: '가져오기',
    }
  }

  if (confirmation.kind === 'new') {
    return {
      title: '새 일기를 시작할까요?',
      description: '현재 임시저장은 비워지고 새 기록을 시작합니다. 이어 쓰려면 취소해 주세요.',
      confirmLabel: '새로 시작',
    }
  }

  if (confirmation.kind === 'recover') {
    return {
      title: '손상된 로컬 데이터를 초기화할까요?',
      description: '현재 브라우저에 저장된 일기와 임시저장이 모두 삭제됩니다. 복구할 수 없는 경우에만 진행해 주세요.',
      confirmLabel: '초기화하고 계속',
    }
  }

  return {
    title: 'Moodi 데이터를 모두 삭제할까요?',
    description: '기록, 임시저장, 로컬 프로필, 테마와 앱 설정이 모두 삭제되며 되돌릴 수 없습니다.',
    confirmLabel: '전체 삭제',
  }
}
