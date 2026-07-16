import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, type Page } from '@playwright/test'
import {
  expectMobileInputFontSize,
  expectMobileTouchTargets,
  expectNoHorizontalOverflow,
  expectStableVisualLayout,
  expectVisualViewportLayout,
  expectWithinViewport,
  resetMoodiStorage,
  test,
} from './testSupport'

const screenshotStage = process.env.MOODI_MOBILE_AI_STAGE
const screenshotRoot = screenshotStage
  ? resolve('artifacts', 'ui-review', 'mobile-ai', screenshotStage)
  : resolve('artifacts', 'ui-review', 'mobile-ai')

test.beforeEach(async ({ page }) => {
  await resetMoodiStorage(page)
})

test.beforeAll(async ({ browserName }, testInfo) => {
  if (
    screenshotStage &&
    browserName === 'chromium' &&
    testInfo.project.name === 'desktop-chrome'
  ) {
    await rm(screenshotRoot, { force: true, recursive: true })
  }
  await mkdir(screenshotRoot, { recursive: true })
})

test('모바일 App Bar·드로어·하단 탭과 작성 진입을 검증한다', async ({ page, runtimeIssues }, testInfo) => {
  const viewport = testInfo.project.use.viewport

  test.skip(!viewport || viewport.width > 900, '모바일 셸 전용 검증')

  const appBar = page.locator('.moodi-common-mobile-header')
  const bottomNavigation = page.getByRole('navigation', { name: '모바일 주요 메뉴' })
  const menuButton = page.getByRole('button', { name: '메뉴 열기', exact: true })

  await expect(appBar).toBeVisible()
  await expect(bottomNavigation).toBeVisible()
  await expect(bottomNavigation.getByRole('button')).toHaveCount(5)
  await expect(bottomNavigation.getByRole('button', { name: 'AI', exact: true })).toBeVisible()
  await expect(bottomNavigation.getByRole('button', { name: /작성/ })).toHaveCount(0)

  await menuButton.click()
  const drawer = page.getByRole('dialog', { name: 'moodi' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('button', { name: '새 기록', exact: true })).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'AI와 대화' })).toBeVisible()
  await expect(drawer.getByText('최근 기록', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden')
  await expectWithinViewport(drawer)

  await page.keyboard.press('Shift+Tab')
  expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(menuButton).toBeFocused()
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('')

  await menuButton.click()
  await page.locator('.moodi-mobile-drawer-backdrop').click({
    position: { x: viewport.width - 2, y: 120 },
  })
  await expect(drawer).toBeHidden()
  await expect(menuButton).toBeFocused()

  await bottomNavigation.getByRole('button', { name: 'AI', exact: true }).click()
  await expect(page).toHaveURL(/\/ai$/)
  await expect(bottomNavigation.getByRole('button', { name: 'AI', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('button', { name: '새 AI 대화' }).click()
  await expect(page.getByRole('textbox', { name: '내 기록에 질문하기' })).toBeVisible()

  await page.getByRole('button', { name: '메뉴 열기', exact: true }).click()
  await page.getByRole('dialog', { name: 'moodi' }).getByRole('button', { name: '새 기록', exact: true }).click()
  await expect(page).toHaveURL(/\/write$/)
  await expect(page.locator('.moodi-common-mobile-header')).toHaveCount(0)
  await expect(page.locator('.moodi-common-bottom-navigation')).toHaveCount(0)
  const mobileEditorToolbar = page.getByRole('toolbar', { name: '모바일 편집 도구' })
  await expect(mobileEditorToolbar).toBeVisible()
  await expect(mobileEditorToolbar.getByRole('button')).toHaveCount(6)
  await mobileEditorToolbar.getByRole('button', { name: '감정 선택' }).click()
  await expect(page.getByRole('region', { name: '감정과 에너지 선택' })).toBeVisible()

  await expectMobileInputFontSize(page)
  await expectMobileTouchTargets(page)
  await expectNoHorizontalOverflow(page)
  await expectVisualViewportLayout(page)
  runtimeIssues.assertClean()
})

test('AI 로컬 검색·출처 이동·대화 관리·결과 없음·취소를 검증한다', async ({ page, runtimeIssues }, testInfo) => {
  const entry = await createUserJournal(page)

  await page.goto('/ai')
  await expect(page.getByText('로컬 기록 검색', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/외부 AI가 아니라/)).toBeVisible()
  await page.getByRole('button', { name: '최근 회고 보기' }).click()
  await expect(page).toHaveURL(/\/insights$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/ai$/)
  await page.getByRole('button', { name: '프로젝트와 관련된 기록을 모아줘' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: /질문을 대화에 저장|실제 기록을 찾고/ }),
  ).toBeVisible()

  const assistantMessage = page.getByRole('article', { name: 'Moodi 로컬 검색 답변' }).last()
  await expect(assistantMessage).toBeVisible()
  await expect(assistantMessage).toContainText('실제 기록')
  await expect(assistantMessage.getByRole('region', { name: '답변에 사용한 기록' })).toBeVisible()
  const sourceCard = assistantMessage.locator('.journal-source-card').first()
  await expect(sourceCard).toContainText(entry.title)
  await expect(sourceCard).toContainText('프로젝트를 마무리하며')

  await page.reload()
  await expect(
    page.getByRole('article', { name: 'Moodi 로컬 검색 답변' }).last()
      .locator('.journal-source-card').first(),
  ).toContainText(entry.title)

  await sourceCard.click()
  await expect(page).toHaveURL(new RegExp(`/entries/${entry.id}$`))
  await expect(page.getByRole('heading', { name: entry.title })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/ai$/)

  if (testInfo.project.name === 'mobile') {
    await page.getByRole('button', { name: '대화 기록 열기' }).click()
    const historyDialog = page.getByRole('dialog', { name: '대화 기록' })
    await expect(historyDialog).toBeVisible()
    const renameButton = historyDialog.getByRole('button', { name: /이름 바꾸기/ }).first()
    await renameButton.click()
    await historyDialog.getByRole('textbox', { name: '대화 이름', exact: true }).fill('프로젝트 회고')
    await historyDialog.getByRole('button', { name: '대화 이름 저장' }).click()
    await expect(historyDialog.getByText('프로젝트 회고', { exact: true })).toBeVisible()
    await historyDialog.getByRole('button', { name: '대화 기록 닫기' }).click()

    const composer = page.getByRole('textbox', { name: '내 기록에 질문하기' })
    await composer.fill(Array.from({ length: 12 }, () => '내 기록의 흐름을 자세히 살펴봐줘').join('\n'))
    await expect.poll(() => page.evaluate(() => {
      const composerElement = document.querySelector<HTMLElement>('.ai-composer')
      const region = document.querySelector<HTMLElement>('.ai-conversation-region')

      if (!composerElement || !region) return false

      return Number.parseFloat(getComputedStyle(region).paddingBottom) >=
        composerElement.getBoundingClientRect().height
    })).toBe(true)

    await composer.fill('존재하지않는고유검색어 기록을 찾아줘')
    await page.getByRole('button', { name: '질문 보내기' }).click()
    await expect(page.getByText(/찾지 못했어요/).last()).toBeVisible()

    await composer.fill('프로젝트 기록을 다시 찾아줘')
    await page.getByRole('button', { name: '질문 보내기' }).click()
    await page.getByRole('button', { name: '대화 기록 열기' }).click()
    await expect(historyDialog.locator('.ai-history-open').first()).toBeDisabled()
    await expect(historyDialog.locator('.ai-history-actions button').first()).toBeDisabled()
    await historyDialog.getByRole('button', { name: '대화 기록 닫기' }).click()
    await page.getByRole('button', { name: '로컬 기록 검색 중단' }).click()
    await expect(page.getByText('로컬 기록 검색을 중단했어요.')).toBeVisible()
    await expect(composer).toHaveValue('프로젝트 기록을 다시 찾아줘')

    await page.getByRole('button', { name: '대화 기록 열기' }).click()
    await historyDialog.getByRole('button', { name: '프로젝트 회고 삭제' }).click()
    const deleteDialog = page.getByRole('alertdialog', { name: '이 대화를 삭제할까요?' })
    await expect(deleteDialog).toBeVisible()
    await deleteDialog.getByRole('button', { name: '대화 삭제' }).click()
    await expect(deleteDialog).toBeHidden()
  }

  await expectNoHorizontalOverflow(page)
  await expectStableVisualLayout(page)
  await expectMobileInputFontSize(page)
  await expectMobileTouchTargets(page)
  await expectVisualViewportLayout(page)
  runtimeIssues.assertClean()
})

test('AI 대화 저장 오류 상태를 텍스트로 표시한다', async ({ page, runtimeIssues }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '대표 모바일 viewport에서 오류 상태 검증')

  const diaryStorageBefore = await page.evaluate(() => {
    const diaryStorage = window.localStorage.getItem('moodi.diary.entries.v2')
    window.localStorage.setItem(
      'moodi.journal-ai.conversations.v1',
      '{"schemaVersion":1,"conversations":"broken"}',
    )

    return diaryStorage
  })
  await page.goto('/ai')

  await expect(page.getByRole('alert')).toContainText('AI 대화 기록이 손상됐어요')
  await expect(page.getByRole('alert')).toContainText('대화 목록 형식이 올바르지 않습니다')
  await expect(page.getByRole('button', { name: '다시 불러오기' })).toBeVisible()
  await page.getByRole('button', { name: 'AI 대화 기록 초기화' }).click()
  const resetDialog = page.getByRole('alertdialog', { name: 'AI 대화 기록을 초기화할까요?' })
  await expect(resetDialog).toContainText('저장한 일기 원문은 유지됩니다')
  await resetDialog.getByRole('button', { name: 'AI 대화만 초기화' }).click()
  await expect(page.getByText('손상된 AI 대화 기록을 초기화했어요. 일기 원문은 삭제하지 않았습니다.')).toBeVisible()
  await expect.poll(() => page.evaluate(() =>
    window.localStorage.getItem('moodi.journal-ai.conversations.v1'),
  )).toBeNull()
  expect(await page.evaluate(() =>
    window.localStorage.getItem('moodi.diary.entries.v2'),
  )).toBe(diaryStorageBefore)
  runtimeIssues.assertClean()
})

test('AI 전송 중 저장 오류도 대기 상태에 고착되지 않는다', async ({ page, runtimeIssues }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '대표 모바일 viewport에서 전송 오류 검증')

  await page.goto('/ai')
  await page.getByRole('button', { name: '새 AI 대화' }).click()
  const composer = page.getByRole('textbox', { name: '내 기록에 질문하기' })
  await expect(composer).toBeVisible()
  await page.evaluate(() => {
    window.localStorage.setItem(
      'moodi.journal-ai.conversations.v1',
      '{"schemaVersion":1,"conversations":"broken"}',
    )
  })
  await composer.fill('프로젝트 기록을 찾아줘')
  await page.getByRole('button', { name: '질문 보내기' }).click()

  await expect(page.getByRole('alert')).toContainText('AI 대화 기록이 손상됐어요')
  await expect(page.getByRole('button', { name: '질문 보내기' })).toBeEnabled()
  await expect(page.getByRole('button', { name: '로컬 기록 검색 중단' })).toHaveCount(0)
  runtimeIssues.assertClean()
})

test('AI 최종 저장 실패 시 출처 없는 임시 답변을 화면에서 제거한다', async ({ page, runtimeIssues }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', '대표 모바일 viewport에서 최종 저장 실패 검증')

  await createUserJournal(page)
  await page.goto('/ai')
  await page.getByRole('button', { name: '새 AI 대화' }).click()
  await page.evaluate(() => {
    const nativeSetItem = Storage.prototype.setItem

    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === 'moodi.journal-ai.conversations.v1') {
        const parsed = JSON.parse(value) as {
          conversations?: Array<{ messages?: Array<{ role?: string }> }>
        }
        const lastMessage = parsed.conversations?.[0]?.messages?.at(-1)

        if (lastMessage?.role === 'assistant') {
          throw new DOMException('simulated quota failure', 'QuotaExceededError')
        }
      }

      return nativeSetItem.call(this, key, value)
    }
  })
  const composer = page.getByRole('textbox', { name: '내 기록에 질문하기' })
  await composer.fill('프로젝트 기록을 찾아줘')
  await page.getByRole('button', { name: '질문 보내기' }).click()

  await expect(page.getByRole('alert')).toContainText('브라우저 저장소를 사용할 수 없어요')
  await expect(page.locator('.ai-streaming-message')).toHaveCount(0)
  await expect(composer).toHaveValue('프로젝트 기록을 찾아줘')
  runtimeIssues.assertClean()
})

test('필수 모바일·AI 검수 스크린샷을 생성한다', async ({ page, runtimeIssues }, testInfo) => {
  const viewport = testInfo.project.use.viewport

  if (!viewport) return

  if ([360, 390, 430].includes(viewport.width)) {
    await capture(page, `home-${viewport.width}x${viewport.height}.png`)
  }

  if (viewport.width === 390 && viewport.height === 844) {
    await page.getByRole('button', { name: '메뉴 열기', exact: true }).click()
    await capture(page, 'drawer-390x844.png')
    await page.keyboard.press('Escape')
    await capture(page, 'bottom-nav-390x844.png')

    await page.goto('/ai')
    await capture(page, 'ai-empty-390x844.png')

    await page.goto('/write')
    await fillJournalDraft(page)
    await capture(page, 'editor-390x844.png')
    await page.getByLabel('일기 본문 블록 편집기').focus()
    await emulateSoftwareKeyboard(page)
    await expect(page.locator('.moodi-app-shell')).toHaveClass(/is-keyboard-open/)
    await expect(page.locator('.moodi-common-bottom-navigation')).toBeHidden()
    await expectVisualViewportLayout(page)
    await capture(page, 'editor-keyboard-layout-390x844.png')
    await restoreSoftwareKeyboard(page)
    await page.getByRole('button', { name: '완료', exact: true }).click()
    await expect(page).toHaveURL(/\/entries\/.+/)
    await capture(page, 'entry-detail-390x844.png')

    await page.goto('/ai')
    await page.getByRole('button', { name: '프로젝트와 관련된 기록을 모아줘' }).click()
    await expect(page.getByRole('article', { name: 'Moodi 로컬 검색 답변' })).toBeVisible()
    await capture(page, 'ai-conversation-390x844.png')
    await page.locator('.ai-message-sources').last().scrollIntoViewIfNeeded()
    await capture(page, 'ai-sources-390x844.png')
    await page.getByRole('textbox', { name: '내 기록에 질문하기' }).focus()
    await emulateSoftwareKeyboard(page)
    await expect(page.locator('.moodi-app-shell')).toHaveClass(/is-keyboard-open/)
    await expect(page.locator('.moodi-common-bottom-navigation')).toBeHidden()
    await expectVisualViewportLayout(page)
    await capture(page, 'ai-keyboard-layout-390x844.png')
    await restoreSoftwareKeyboard(page)

    await page.goto('/calendar')
    await capture(page, 'calendar-390x844.png')
    await page.goto('/insights')
    await capture(page, 'reflection-390x844.png')
  }

  if (viewport.width === 1440 && viewport.height === 900) {
    await createUserJournal(page)
    await page.goto('/ai')
    await page.getByRole('button', { name: '프로젝트와 관련된 기록을 모아줘' }).click()
    await expect(page.getByRole('article', { name: 'Moodi 로컬 검색 답변' })).toBeVisible()
    const aiShellGeometry = await page.locator('.ai-chat-page').evaluate((element) => {
      const pageBox = element.getBoundingClientRect()
      const mainBox = element.closest('main')?.getBoundingClientRect()

      return {
        height: pageBox.height,
        mainWidth: mainBox?.width ?? 0,
        width: pageBox.width,
      }
    })

    expect(Math.abs(aiShellGeometry.width - aiShellGeometry.mainWidth)).toBeLessThanOrEqual(1)
    expect(Math.abs(aiShellGeometry.height - viewport.height)).toBeLessThanOrEqual(1)
    await capture(page, 'ai-desktop-1440x900.png')
  }

  await expectNoHorizontalOverflow(page)
  await expectStableVisualLayout(page)
  await expectMobileInputFontSize(page)
  await expectMobileTouchTargets(page)
  await expectVisualViewportLayout(page)
  runtimeIssues.assertClean()
})

async function createUserJournal(page: Page) {
  await page.goto('/write')
  await fillJournalDraft(page)
  await page.getByRole('button', { name: '완료', exact: true }).click()
  await expect(page).toHaveURL(/\/entries\/.+/)
  const id = new URL(page.url()).pathname.split('/').at(-1) ?? ''

  return { id, title: '모바일에서 마무리한 프로젝트' }
}

async function fillJournalDraft(page: Page): Promise<void> {
  await page.getByLabel('일기 제목').fill('모바일에서 마무리한 프로젝트')
  const blockEditor = page.getByLabel('일기 본문 블록 편집기')
  await blockEditor.click()
  await page.keyboard.insertText(
    '프로젝트를 마무리하며 마지막 오류를 고쳤다. 팀과 함께 결과를 확인하고 나니 마음이 차분해졌다. 실제 기록의 원문과 출처를 다시 찾을 수 있어 안심이 됐다.',
  )
  await expect.poll(() => page.evaluate(() =>
    window.localStorage.getItem('moodi.diary.draft.v1')?.includes('프로젝트를 마무리하며'),
  )).toBe(true)
}

async function capture(page: Page, fileName: string): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto'
  })
  await page.evaluate(async () => document.fonts.ready)
  await page.waitForTimeout(80)
  await page.screenshot({
    animations: 'disabled',
    fullPage: false,
    path: resolve(screenshotRoot, fileName),
  })
}

async function emulateSoftwareKeyboard(page: Page): Promise<void> {
  const didEmulate = await page.evaluate(() => {
    const viewport = window.visualViewport

    if (!viewport) return false

    try {
      Object.defineProperty(viewport, 'height', {
        configurable: true,
        value: Math.max(420, window.innerHeight - 320),
      })
      viewport.dispatchEvent(new Event('resize'))
      return true
    } catch {
      return false
    }
  })

  expect(didEmulate, 'Chromium visualViewport keyboard emulation failed').toBe(true)
}

async function restoreSoftwareKeyboard(page: Page): Promise<void> {
  await page.evaluate(() => {
    const viewport = window.visualViewport

    if (!viewport) return
    delete (viewport as VisualViewport & { height?: number }).height
    viewport.dispatchEvent(new Event('resize'))
  })
  await expect(page.locator('.moodi-app-shell')).not.toHaveClass(/is-keyboard-open/)
}
