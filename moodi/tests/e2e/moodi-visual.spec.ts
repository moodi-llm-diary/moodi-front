import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, type Page } from '@playwright/test'
import {
  expectNoBrokenImages,
  expectNoHorizontalOverflow,
  expectMobileTouchTargets,
  expectSemanticColorContrast,
  expectStableVisualLayout,
  expectWithinViewport,
  resetMoodiStorage,
  test,
} from './testSupport'

const screenshotStage = process.env.MOODI_SCREENSHOT_STAGE ?? 'final'
const screenshotRoot = resolve('artifacts', 'ui-review', screenshotStage)

test.beforeEach(async ({ page }) => {
  await resetMoodiStorage(page)
})

test.beforeAll(async ({ browserName }, testInfo) => {
  if (browserName === 'chromium' && testInfo.project.name === 'desktop-chrome') {
    await rm(screenshotRoot, { force: true, recursive: true })
  }
  await mkdir(screenshotRoot, { recursive: true })
})

test('오늘 화면의 실제 콘텐츠, 폰트, 반응형 레이아웃을 검증한다', async ({ page, runtimeIssues }, testInfo) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '오늘은 어떤 하루였어?' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '최근 기록' })).toBeVisible()
  await expect(page.getByRole('button', { name: /계속 읽기/ }).first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoBrokenImages(page)
  await expectStableVisualLayout(page)
  await expectMobileTouchTargets(page)
  await expectPretendard(page)
  await expectSemanticColorContrast(page)
  await expectDesktopMainArea(page, [])
  await expectHomeFlatSurfaces(page)
  await capture(page, `home-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)

  await page.getByRole('button', { name: '기분만 남기기' }).click()
  await expect(page.getByRole('dialog', { name: '지금 기분은 어때?' })).toBeVisible()
  await expectWithinViewport(page.getByRole('dialog', { name: '지금 기분은 어때?' }))
  await capture(page, `quick-record-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)
  await page.getByRole('button', { name: '빠른 기록 닫기' }).click()

  if ((testInfo.project.use.viewport?.width ?? 0) > 900) {
    const sidebar = page.getByRole('complementary', { name: 'Moodi 문서 탐색' })
    await expect(sidebar.getByText('최근 기록', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '사이드바 접기' }).click()
    await expect(page.getByRole('button', { name: '사이드바 펼치기' })).toBeVisible()
    await capture(page, `home-sidebar-collapsed-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)
    await page.reload()
    await expect(page.getByRole('button', { name: '사이드바 펼치기' })).toBeVisible()
    await page.getByRole('button', { name: '사이드바 펼치기' }).click()
    await expect(page.getByRole('button', { name: '사이드바 접기' })).toBeVisible()
  }

  runtimeIssues.assertClean()
})

test('작성 화면을 검증한다', async ({ page, runtimeIssues }, testInfo) => {
  await page.goto('/write')

  await expect(page.getByRole('heading', { name: '오늘의 일기 쓰기' })).toBeAttached()
  await expect(page.getByLabel('일기 본문')).toBeVisible()
  await expect(page.getByRole('group', { name: '기록에 바로 더하기' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectStableVisualLayout(page)
  await expectMobileTouchTargets(page)
  await expectDesktopMainArea(page, ['.editor-paper'])
  await capture(page, `write-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)

  await page.getByRole('button', { name: '감정 추가' }).click()
  const metadataPopover = page.getByRole('dialog', { name: '기록 메타데이터 편집' })
  await expect(metadataPopover).toBeVisible()
  await expectWithinViewport(metadataPopover)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '감정 추가' })).toBeFocused()

  await page.getByLabel('커버 이미지 추가').setInputFiles(
    resolve('src/assets/diary-afternoon-table.webp'),
  )
  await expect(page.locator('.editor-cover-preview img')).toBeVisible()
  await expectNoBrokenImages(page)
  await page.getByRole('button', { name: '커버 이미지 제거' }).click()

  const blockEditor = page.getByLabel('일기 본문 블록 편집기')
  await blockEditor.click()
  await page.keyboard.type('/')
  await expect(page.getByRole('dialog', { name: '블록 추가 메뉴' })).toBeVisible()
  await expectWithinViewport(page.getByRole('dialog', { name: '블록 추가 메뉴' }))
  await capture(page, `slash-menu-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)
  await page.keyboard.press('Escape')
  await expect(blockEditor).toBeFocused()
  await page.getByLabel('본문에 사진 블록 추가').setInputFiles(
    resolve('src/assets/diary-afternoon-table.webp'),
  )
  await expect(page.locator('.diary-image-block img')).toBeVisible()
  await page.locator('.diary-image-block img').click()
  await expect(page.getByRole('group', { name: '선택한 사진 설정' })).toBeVisible()
  await expectMobileTouchTargets(page)
  await expectNoBrokenImages(page)
  await capture(page, `write-image-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)

  runtimeIssues.assertClean()
})

test('기록 목록과 상세 화면을 검증한다', async ({ page, runtimeIssues }, testInfo) => {
  await page.goto('/entries')
  await expect(page.getByRole('heading', { name: '기록', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoBrokenImages(page)
  await expectStableVisualLayout(page)
  await expectMobileTouchTargets(page)
  await expectDesktopMainArea(page, ['.diary-list-item'])
  if ((testInfo.project.use.viewport?.width ?? 0) > 900) {
    await expect(page.locator('.entries-view .featured-diary-entry')).toHaveCount(0)
  }
  await capture(page, `entries-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)

  await page.getByRole('button', { name: '필터', exact: true }).click()
  await expectWithinViewport(page.getByRole('dialog', { name: '기록 필터' }))
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /상세 보기/ }).first().click()
  await expect(page.getByRole('article', { name: '사용자가 작성한 일기 본문' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Moodi가 남긴 한마디' }).first()).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoBrokenImages(page)
  await expectStableVisualLayout(page)
  await expectMobileTouchTargets(page)
  await expectDesktopMainArea(page, ['.entry-reader'])
  await capture(page, `entry-detail-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)

  runtimeIssues.assertClean()
})

test('캘린더와 회고 화면을 검증한다', async ({ page, runtimeIssues }, testInfo) => {
  await page.goto('/calendar')
  await expect(page.getByRole('heading', { name: '캘린더', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoBrokenImages(page)
  await expectStableVisualLayout(page)
  await expectMobileTouchTargets(page)
  await expectDesktopMainArea(page, ['.calendar-workspace'])
  await capture(page, `calendar-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)

  await page.goto('/insights')
  await expect(page.getByRole('heading', { name: '이번 주 돌아보기' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '감정의 흐름' })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await expectNoBrokenImages(page)
  await expectStableVisualLayout(page)
  await expectMobileTouchTargets(page)
  await expectDesktopMainArea(page, ['.insights-summary', '.insights-chart-panel'])
  await capture(page, `reflection-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)

  runtimeIssues.assertClean()
})

test('설정과 다크 테마를 검증한다', async ({ page, runtimeIssues }, testInfo) => {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible()
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f5f5f7')
  await expect(page.getByRole('heading', { name: '화면과 글자' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '기록과 개인정보' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Moodi의 기록 도움' })).toBeVisible()
  await capture(page, `settings-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)

  await page.getByText('외부 데이터 연결', { exact: true }).click()
  await expect(page.getByRole('button', { name: '연결 준비 중' }).first()).toBeDisabled()
  await page.getByRole('button', { name: /다크/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-moodi-theme', 'midnight')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#171719')
  await expect.poll(async () => page.evaluate(() => window.localStorage.getItem('moodi.mvp.theme.v1'))).toBe('midnight')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-moodi-theme', 'midnight')
  await expectSemanticColorContrast(page)
  await expectNoHorizontalOverflow(page)
  await expectNoBrokenImages(page)
  await expectStableVisualLayout(page)
  await expectMobileTouchTargets(page)
  await capture(page, `settings-dark-${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}.png`)

  runtimeIssues.assertClean()
})

async function capture(page: Page, fileName: string): Promise<void> {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0
  })
  await page.waitForTimeout(50)
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.screenshot({
    animations: 'disabled',
    fullPage: false,
    path: resolve(screenshotRoot, fileName),
  })
}

async function expectPretendard(page: Page): Promise<void> {
  const typography = await page.getByRole('heading', { name: '오늘은 어떤 하루였어?' }).evaluate((element) => {
    const style = window.getComputedStyle(element)

    return {
      fontFamily: style.fontFamily,
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
    }
  })

  expect(typography.fontFamily).toContain('Pretendard Variable')
  expect(typography.fontSize).toBeGreaterThanOrEqual(30)
  expect(typography.lineHeight).toBeGreaterThan(typography.fontSize)
  expect(await page.evaluate(() => document.fonts.check('16px "Pretendard Variable"'))).toBe(true)
  const fontResources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((resourceName) => /pretendard/i.test(resourceName) && /\.woff2?(?:\?|$)/i.test(resourceName)),
  )
  expect(fontResources.length).toBeGreaterThan(0)
}

async function expectDesktopMainArea(page: Page, flatSurfaceSelectors: string[]): Promise<void> {
  const viewport = page.viewportSize()

  if (!viewport || viewport.width <= 900) return

  const geometry = await page.evaluate(() => {
    const sidebar = document.querySelector<HTMLElement>('.moodi-sidebar')
    const mainArea = document.querySelector<HTMLElement>('.moodi-main-area')

    if (!sidebar || !mainArea) return null

    const sidebarBox = sidebar.getBoundingClientRect()
    const mainAreaBox = mainArea.getBoundingClientRect()

    return {
      mainLeft: mainAreaBox.left,
      mainRight: mainAreaBox.right,
      sidebarRight: sidebarBox.right,
      viewportWidth: window.innerWidth,
    }
  })

  expect(geometry).not.toBeNull()
  expect(Math.abs((geometry?.mainLeft ?? 0) - (geometry?.sidebarRight ?? 0))).toBeLessThanOrEqual(1)
  expect(Math.abs((geometry?.mainRight ?? 0) - (geometry?.viewportWidth ?? 0))).toBeLessThanOrEqual(1)

  for (const selector of flatSurfaceSelectors) {
    const surface = page.locator(selector).first()

    await expect(surface, `${selector}가 렌더링되어야 합니다.`).toBeVisible()
    const style = await surface.evaluate((element) => {
      const computedStyle = window.getComputedStyle(element)

      return {
        backgroundColor: computedStyle.backgroundColor,
        borderRadius: computedStyle.borderRadius,
        boxShadow: computedStyle.boxShadow,
      }
    })

    expect(style.backgroundColor, selector).toBe('rgba(0, 0, 0, 0)')
    expect(style.borderRadius, selector).toBe('0px')
    expect(style.boxShadow, selector).toBe('none')
  }
}

async function expectHomeFlatSurfaces(page: Page): Promise<void> {
  for (const selector of [
    '.today-hero',
    '.featured-diary-entry',
    '.today-recent-list .diary-list-item',
    '.today-question-section',
  ]) {
    const surface = page.locator(selector).first()

    await expect(surface, `${selector}가 평면 section으로 렌더링되어야 합니다.`).toBeVisible()
    const style = await surface.evaluate((element) => {
      const computedStyle = window.getComputedStyle(element)

      return {
        backgroundColor: computedStyle.backgroundColor,
        borderRadius: computedStyle.borderRadius,
        boxShadow: computedStyle.boxShadow,
      }
    })

    expect(style.backgroundColor, selector).toBe('rgba(0, 0, 0, 0)')
    expect(style.borderRadius, selector).toBe('0px')
    expect(style.boxShadow, selector).toBe('none')
  }
}
