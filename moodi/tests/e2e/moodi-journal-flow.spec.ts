import { resolve } from 'node:path'
import { expect } from '@playwright/test'
import {
  expectMobileTouchTargets,
  expectNoHorizontalOverflow,
  expectWithinViewport,
  resetMoodiStorage,
  test,
} from './testSupport'

test.beforeEach(async ({ page }) => {
  await resetMoodiStorage(page)
})

test('긴 일기의 자동저장·복구·생성·수정·즐겨찾기·삭제를 검증한다', async ({ page, runtimeIssues }) => {
  const title = 'Playwright로 남긴 여름 저녁'
  const updatedTitle = 'Playwright로 다시 남긴 여름 저녁'
  const body = [
    '오늘은 오래 미뤄 둔 생각을 차분히 정리했다.',
    '창문을 열어 두니 바람이 들어왔고, 문장을 하나씩 적을수록 마음도 조금 가벼워졌다.',
    '완벽하지 않아도 오늘의 모습을 남겼다는 사실이 좋았다.',
  ].join('\n\n')

  await page.getByRole('button', { name: '오늘 기록하기', exact: true }).click()
  await expect(page).toHaveURL(/\/write$/)
  await page.getByLabel('일기 제목').fill(title)
  const blockEditor = page.getByLabel('일기 본문 블록 편집기')
  await blockEditor.click()
  await page.keyboard.insertText(body)
  await page.getByRole('button', { name: '감정', exact: true }).click()
  await page.getByRole('button', { name: /^편안함:/ }).click()
  await page.getByRole('button', { name: '에너지 4단계, 좋음' }).click()
  await page.getByRole('button', { name: '태그', exact: true }).click()
  await page.getByLabel('사용자 태그').fill('회고')
  await page.getByLabel('사용자 태그').press('Enter')
  await page.getByLabel('사용자 태그').fill('삭제할태그')
  await page.getByLabel('사용자 태그').press('Enter')
  await page.getByRole('button', { name: '삭제할태그 태그 삭제' }).click()
  await page.getByLabel('커버 이미지 추가').setInputFiles(
    resolve('src/assets/diary-evening-walk.webp'),
  )
  await expect(page.locator('.editor-cover-preview img')).toBeVisible()
  await blockEditor.click()
  await page.keyboard.press('Control+End')
  await page.getByLabel('본문에 사진 블록 추가').setInputFiles(
    resolve('src/assets/diary-afternoon-table.webp'),
  )
  await expect(page.locator('.diary-image-block img')).toBeVisible()

  await expect.poll(async () => page.evaluate(() => {
    const draft = window.localStorage.getItem('moodi.diary.draft.v1')

    return Boolean(
      draft?.includes('Playwright로 남긴 여름 저녁') &&
      draft.includes('data:image/webp;base64') &&
      draft.includes('data-diary-image') &&
      draft.includes('"role":"inline"'),
    )
  })).toBe(true)

  const storedDraft = await page.evaluate(() => window.localStorage.getItem('moodi.diary.draft.v1'))
  expect(storedDraft).toContain('사실이 좋았다')

  await page.reload()
  await expect(page.getByLabel('일기 제목')).toHaveValue(title)
  await expect(page.getByLabel('일기 본문 블록 편집기')).toContainText('오늘은 오래 미뤄 둔 생각을 차분히 정리했다.')
  await expect(page.getByLabel('일기 본문 블록 편집기')).toContainText('완벽하지 않아도 오늘의 모습을 남겼다는 사실이 좋았다.')
  await expect(page.getByText('복구됨')).toBeVisible()
  await expect(page.locator('.editor-cover-preview img')).toBeVisible()

  await page.getByRole('button', { name: '완료', exact: true }).click()
  await expect(page).toHaveURL(/\/entries\/.+/)
  expect(await page.evaluate(() => window.localStorage.getItem('moodi.diary.entries.v2'))).toContain('data-diary-image')
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
  await expect(page.getByRole('article', { name: '사용자가 작성한 일기 본문' })).toContainText('오늘은 오래 미뤄 둔 생각을 차분히 정리했다.')
  await expect(page.getByRole('article', { name: '사용자가 작성한 일기 본문' })).toContainText('완벽하지 않아도 오늘의 모습을 남겼다는 사실이 좋았다.')
  await expect(page.getByRole('article', { name: '사용자가 작성한 일기 본문' }).getByRole('img').first()).toBeVisible()
  await expect(page.getByRole('article', { name: '사용자가 작성한 일기 본문' }).getByRole('img')).toHaveCount(2)
  await page.getByText('기록 정보', { exact: true }).click()
  await expect(page.getByText('4/5', { exact: true })).toBeVisible()

  const favoriteButton = page.getByRole('button', { name: '즐겨찾기에 추가' })
  await favoriteButton.click()
  await expect(page.getByRole('button', { name: '즐겨찾기 해제' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByLabel('기록 관리 메뉴').click()
  await page.getByRole('button', { name: '수정', exact: true }).click()
  await expect(page).toHaveURL(/\/write\?entry=/)
  await page.locator('.diary-image-block img').click()
  await page.getByLabel('현재 블록 메뉴').click()
  await page.getByRole('menuitem', { name: '블록 삭제' }).click()
  await expect(page.locator('.diary-image-block')).toHaveCount(0)
  await page.getByLabel('일기 제목').fill(updatedTitle)
  await page.getByRole('button', { name: '수정 완료' }).click()
  await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible()
  await expect(page.getByRole('article', { name: '사용자가 작성한 일기 본문' }).getByRole('img')).toHaveCount(1)
  expect(await page.evaluate(() => window.localStorage.getItem('moodi.diary.entries.v2'))).not.toContain('"role":"inline"')

  await page.reload()
  await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible()
  await expect(page.getByRole('button', { name: '즐겨찾기 해제' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByLabel('기록 관리 메뉴').click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  const deleteDialog = page.getByRole('alertdialog', { name: '이 기록을 삭제할까요?' })
  await expect(deleteDialog).toBeVisible()
  await expect(deleteDialog.getByRole('button', { name: '취소' })).toBeFocused()
  await deleteDialog.getByRole('button', { name: '취소' }).click()
  await expect(deleteDialog).toBeHidden()

  await page.getByLabel('기록 관리 메뉴').click()
  await page.getByRole('button', { name: '삭제', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: '기록 삭제' }).click()
  await expect(page).toHaveURL(/\/entries$/)
  await expect(page.getByText(updatedTitle)).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  runtimeIssues.assertClean()
})

test('slash command와 주요 블록·인라인 서식·블록 이동을 검증한다', async ({ page, runtimeIssues }) => {
  await page.goto('/write')
  const editor = page.getByLabel('일기 본문 블록 편집기')

  await editor.click()
  await page.keyboard.type('``` ')
  await expect(editor.locator('pre, code')).toHaveCount(0)
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')
  await page.keyboard.type('오늘의 첫 장면')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  const slashMenu = page.getByRole('dialog', { name: '블록 추가 메뉴' })
  await expect(slashMenu).toBeVisible()
  await expect(slashMenu.getByRole('option', { name: /사진/ })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.keyboard.type('마음에 남은 순간')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  await slashMenu.getByRole('option', { name: /글머리 목록/ }).click()
  await page.keyboard.type('천천히 걸었던 길')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  await slashMenu.getByRole('option', { name: /인용문/ }).click()
  await page.keyboard.type('오늘을 서두르지 않아도 괜찮다')
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  await slashMenu.getByRole('option', { name: /Moodi 질문/ }).click()
  runtimeIssues.assertClean()
  await expect(editor.locator('.moodi-question-block')).toBeVisible()
  await expect(page.getByRole('button', { name: '새 질문 받기' })).toBeVisible()

  await editor.locator('p').first().click()
  await page.keyboard.press('Control+A')
  const bubbleMenu = page.locator('.editor-bubble-menu')
  await expect(bubbleMenu.getByLabel('굵게')).toBeVisible()
  await expectWithinViewport(bubbleMenu)
  await expectMobileTouchTargets(page)
  await bubbleMenu.getByLabel('굵게').click()
  await bubbleMenu.getByLabel('링크').click()
  await page.getByLabel('링크 주소').fill('https://example.com/moodi')
  await page.getByRole('button', { name: '적용', exact: true }).click()
  await expect(editor.locator('a').first()).toHaveAttribute('href', 'https://example.com/moodi')

  await page.getByLabel('현재 블록 메뉴').click()
  await expectMobileTouchTargets(page)
  await page.getByRole('menuitem', { name: '아래로 이동' }).click()
  await expect(editor.locator('h1')).toContainText('마음에 남은 순간')

  await expect.poll(async () => page.evaluate(() =>
    window.localStorage.getItem('moodi.diary.draft.v1')?.includes('마음에 남은 순간'),
  )).toBe(true)
  await expectNoHorizontalOverflow(page)
  runtimeIssues.assertClean()
})

test('빠른 기록이 홈·목록·캘린더와 새로고침 뒤에 유지된다', async ({ page, runtimeIssues }) => {
  const note = '따뜻한 차를 마시며 잠깐 숨을 골랐다.'
  const trigger = page.getByRole('button', { name: '기분만 남기기' })

  await trigger.click()
  const dialog = page.getByRole('dialog', { name: '지금 기분은 어때?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '빠른 기록 닫기' })).toBeFocused()
  await dialog.getByRole('button', { name: /^편안함:/ }).click()
  await dialog.getByRole('button', { name: '에너지 3단계, 보통' }).click()
  await dialog.getByLabel('짧게 남기기').fill(note)
  await dialog.getByText('무엇을 했는지 추가하기').click()
  await dialog.getByRole('button', { name: '휴식', exact: true }).click()
  await dialog.getByRole('button', { name: '기록하기' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByText(note).first()).toBeVisible()
  await page.goto('/entries')
  await expect(page.getByText(note).first()).toBeVisible()
  await page.goto('/calendar')
  await expect(page.getByText(note).first()).toBeVisible()

  await page.reload()
  await expect(page.getByText(note).first()).toBeVisible()
  runtimeIssues.assertClean()
})

test('검색·캘린더 이동·회고·설정과 반응형 내비게이션을 검증한다', async ({ page, runtimeIssues }, testInfo) => {
  const isMobile = (testInfo.project.use.viewport?.width ?? Number.POSITIVE_INFINITY) <= 900

  if (isMobile) {
    const mobileNavigation = page.getByRole('navigation', { name: '모바일 주요 메뉴' })
    await expect(mobileNavigation).toBeVisible()
    await mobileNavigation.getByRole('button', { name: '기록', exact: true }).click()
    await expect(page).toHaveURL(/\/entries$/)

    const touchTargetSizes = await mobileNavigation.getByRole('button').evaluateAll((buttons) =>
      buttons.map((button) => {
        const rectangle = button.getBoundingClientRect()

        return { width: rectangle.width, height: rectangle.height }
      }),
    )
    for (const size of touchTargetSizes) {
      expect(size.width).toBeGreaterThanOrEqual(44)
      expect(size.height).toBeGreaterThanOrEqual(44)
    }
  } else {
    const desktopNavigation = page.getByRole('navigation', { name: '주요 메뉴' })
    await expect(desktopNavigation).toBeVisible()
    await desktopNavigation.getByRole('button', { name: '기록' }).click()
    await expect(page).toHaveURL(/\/entries$/)
  }

  await page.getByRole('button', { name: '검색', exact: true }).click()
  await page.getByLabel('전체 기록 검색').fill('미뤄 두었던')
  await expect(page.getByText('조건에 맞는 기록 1개')).toBeVisible()
  await page
    .getByRole('button', { name: /미뤄 두었던 일을 끝낸 오후 상세 보기/ })
    .click()
  await expect(page).toHaveURL(/\/entries\/.+/)

  await page.goto('/calendar')
  const initialCalendarHeading = await page.getByRole('heading', { name: /\d{4}년 \d{1,2}월/ }).textContent()
  await page.getByRole('button', { name: '다음 달' }).click()
  await expect(page.getByRole('heading', { name: /\d{4}년 \d{1,2}월/ })).not.toHaveText(initialCalendarHeading ?? '')
  await page.locator('.calendar-workspace').getByRole('button', { name: '오늘' }).click()
  const selectedCalendarTitle = page.locator('#calendar-selected-title')
  const initialSelectedDate = await selectedCalendarTitle.textContent()
  const calendarDate = page.locator('.calendar-day-cell:not(.outside-month):not([aria-pressed="true"])').nth(15)
  const calendarDateLabel = await calendarDate.getAttribute('aria-label')
  await calendarDate.click()
  await expect(page.getByRole('button', { name: calendarDateLabel ?? '', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(selectedCalendarTitle).not.toHaveText(initialSelectedDate ?? '')

  await page.goto('/insights')
  await expect(page.getByRole('heading', { name: '이번 주 돌아보기' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '감정의 흐름' })).toBeVisible()

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: '설정', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /계정/ }).click()
  await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  runtimeIssues.assertClean()
})

test('빠른 기록과 삭제 dialog의 Escape·focus 복원을 검증한다', async ({ page, runtimeIssues }) => {
  const quickTrigger = page.getByRole('button', { name: '기분만 남기기' })

  await quickTrigger.focus()
  await quickTrigger.click()
  const quickDialog = page.getByRole('dialog', { name: '지금 기분은 어때?' })
  await expect(quickDialog).toBeVisible()
  await page.keyboard.press('Shift+Tab')
  expect(await quickDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: '지금 기분은 어때?' })).toBeHidden()
  await expect(quickTrigger).toBeFocused()

  await page.getByRole('button', { name: /계속 읽기/ }).click()
  await page.getByLabel('기록 관리 메뉴').click()
  const deleteButton = page.getByRole('button', { name: '삭제', exact: true })
  await deleteButton.click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toBeHidden()
  runtimeIssues.assertClean()
})

test('키보드만으로 skip link와 주요 기록 navigation을 사용할 수 있다', async ({ page, runtimeIssues }) => {

  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: '본문으로 건너뛰기' })
  await expect(skipLink).toBeFocused()
  await expect(skipLink).toBeVisible()

  let didOpenEntries = false
  for (let tabIndex = 0; tabIndex < 10; tabIndex += 1) {
    await page.keyboard.press('Tab')
    const activeName = await page.evaluate(() => {
      const activeElement = document.activeElement

      if (!(activeElement instanceof HTMLElement)) return ''

      return activeElement.getAttribute('aria-label') ?? activeElement.innerText.trim()
    })

    if (activeName === '기록') {
      await page.keyboard.press('Enter')
      didOpenEntries = true
      break
    }
  }

  expect(didOpenEntries).toBe(true)
  await expect(page).toHaveURL(/\/entries$/)
  await expect(page.getByRole('heading', { name: '기록', exact: true })).toBeVisible()
  runtimeIssues.assertClean()
})
