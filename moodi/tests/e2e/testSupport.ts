import { expect, test as base, type Locator, type Page } from '@playwright/test'

export type RuntimeIssueCollector = {
  assertClean: () => void
}

/** 첫 navigation 전부터 런타임 오류를 수집하는 공통 Playwright fixture다. */
export const test = base.extend<{ runtimeIssues: RuntimeIssueCollector }>({
  runtimeIssues: [
    async ({ page }, use) => {
      await use(collectRuntimeIssues(page))
    },
    { auto: true },
  ],
})

/** 프로젝트 런타임에서 발생한 console/page/network 오류를 수집한다. */
export function collectRuntimeIssues(page: Page): RuntimeIssueCollector {
  const issues: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      issues.push(`console.${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`))
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? ''

    // route 전환 중 더는 필요하지 않은 dynamic font subset 취소는 브라우저의 정상 동작이다.
    if (request.resourceType() === 'font' && errorText === 'net::ERR_ABORTED') return

    issues.push(`requestfailed: ${request.method()} ${request.url()} ${errorText}`)
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      issues.push(`response.${response.status()}: ${response.request().method()} ${response.url()}`)
    }
  })

  return {
    assertClean: () => expect(issues, issues.join('\n')).toEqual([]),
  }
}

/** seed와 테스트 기록을 분리하기 위해 Moodi 저장소를 초기 상태로 되돌린다. */
export async function resetMoodiStorage(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
  await expect(page.getByRole('heading', { name: /좋은 아침이에요|잠시, 오늘에 머물러 봐요|오늘도 수고했어요/ })).toBeVisible()
}

/** viewport에서 문서가 가로로 넘치지 않는지 확인한다. */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const rootClientWidth = document.documentElement.clientWidth
    const offenders = Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((element) => {
        const style = window.getComputedStyle(element)
        const box = element.getBoundingClientRect()
        let ancestor: HTMLElement | null = element
        let hasFixedAncestor = false
        while (ancestor) {
          if (window.getComputedStyle(ancestor).position === 'fixed') {
            hasFixedAncestor = true
            break
          }
          ancestor = ancestor.parentElement
        }

        return !hasFixedAncestor && style.position !== 'fixed' && box.width > 0 && (box.left < -1 || box.right > rootClientWidth + 1)
      })
      .slice(0, 8)
      .map((element) => ({
        className: element.className,
        tagName: element.tagName,
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      }))

    return {
      rootScrollWidth: document.documentElement.scrollWidth,
      rootClientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      offenders,
    }
  })

  const diagnostic = JSON.stringify(overflow.offenders, null, 2)

  expect(overflow.rootScrollWidth, diagnostic).toBeLessThanOrEqual(overflow.rootClientWidth + 1)
  expect(overflow.bodyScrollWidth, diagnostic).toBeLessThanOrEqual(overflow.rootClientWidth + 1)
}

/** 열린 메뉴나 dialog가 현재 viewport 안에 완전히 배치되는지 확인한다. */
export async function expectWithinViewport(locator: Locator): Promise<void> {
  await locator.evaluate(async (element) => {
    const animations = element.getAnimations({ subtree: true })

    await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)))
  })

  const bounds = await locator.evaluate((element) => {
    const rectangle = element.getBoundingClientRect()

    return {
      top: rectangle.top,
      right: rectangle.right,
      bottom: rectangle.bottom,
      left: rectangle.left,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    }
  })

  expect(bounds.top).toBeGreaterThanOrEqual(-1)
  expect(bounds.left).toBeGreaterThanOrEqual(-1)
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1)
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1)
}

/** 렌더링된 이미지가 실제 픽셀을 정상적으로 로드했는지 확인한다. */
export async function expectNoBrokenImages(page: Page): Promise<void> {
  const brokenImages = await page.locator('img').evaluateAll((images) =>
    images.flatMap((image) => {
      if (!image.complete || image.naturalWidth === 0) return [image.getAttribute('src')]

      const box = image.getBoundingClientRect()
      const naturalRatio = image.naturalWidth / image.naturalHeight
      const renderedRatio = box.width / box.height
      const isDistorted =
        box.width > 0 &&
        box.height > 0 &&
        window.getComputedStyle(image).objectFit === 'fill' &&
        Math.abs(naturalRatio - renderedRatio) > 0.08

      return isDistorted ? [`distorted:${image.getAttribute('src')}`] : []
    }),
  )

  expect(brokenImages).toEqual([])
}

/** light/dark semantic text 토큰이 일반 텍스트 4.5:1 대비를 유지하는지 계산한다. */
export async function expectSemanticColorContrast(page: Page): Promise<void> {
  const results = await page.evaluate(() => {
    const probe = document.createElement('span')
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    document.body.append(probe)

    const resolveColor = (token: string) => {
      probe.style.color = `var(${token})`
      const match = window.getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number)

      if (!match || match.length < 3) throw new Error(`${token} 색상을 해석하지 못했습니다.`)

      return match.slice(0, 3)
    }
    const luminance = ([red, green, blue]: number[]) => {
      const channels = [red, green, blue].map((channel) => {
        const normalized = channel / 255

        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4
      })

      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
    }
    const surface = luminance(resolveColor('--color-surface'))
    const tokens = [
      '--color-text-primary',
      '--color-text-secondary',
      '--color-text-tertiary',
      '--color-danger',
      '--color-warning',
    ]
    const contrasts = tokens.map((token) => {
      const foreground = luminance(resolveColor(token))
      const ratio = (Math.max(foreground, surface) + 0.05) / (Math.min(foreground, surface) + 0.05)

      return { token, ratio }
    })

    probe.remove()

    return contrasts
  })

  for (const result of results) {
    expect(result.ratio, `${result.token}: ${result.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
  }
}

/** shell, fixed chrome, text box와 비정상 element geometry의 공통 회귀를 검사한다. */
export async function expectStableVisualLayout(page: Page): Promise<void> {
  await expectNoHorizontalOverflow(page)

  const issues = await page.evaluate(() => {
    const found: string[] = []
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const isRendered = (element: Element) => {
      const style = window.getComputedStyle(element)
      const rectangle = element.getBoundingClientRect()

      return style.display !== 'none' && style.visibility !== 'hidden' && rectangle.width > 0 && rectangle.height > 0
    }

    const sidebar = document.querySelector<HTMLElement>('.moodi-sidebar')
    const main = document.querySelector<HTMLElement>('#moodi-main-content')

    if (sidebar && main && isRendered(sidebar)) {
      const sidebarBox = sidebar.getBoundingClientRect()
      const mainBox = main.getBoundingClientRect()

      if (sidebarBox.right > mainBox.left + 1) found.push('sidebar overlaps main content')
    }

    document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], [role="menu"], .filter-popover, .slash-command-menu').forEach((element) => {
      if (!isRendered(element)) return
      const box = element.getBoundingClientRect()

      if (box.left < -1 || box.top < -1 || box.right > viewportWidth + 1 || box.bottom > viewportHeight + 1) {
        found.push(`overlay outside viewport: ${element.getAttribute('aria-label') ?? element.className}`)
      }
    })

    document.querySelectorAll<HTMLElement>('h1, h2, h3, p, button, summary, label').forEach((element) => {
      if (!isRendered(element) || element.closest('.sr-only') || element.classList.contains('sr-only')) return
      const style = window.getComputedStyle(element)
      const color = style.color.replace(/\s/g, '')

      if (element.textContent?.trim() && /rgba\([^)]*,0(?:\.0+)?\)$/.test(color)) {
        found.push(`transparent text: ${element.textContent.trim().slice(0, 32)}`)
      }
      if (
        element.scrollWidth > element.clientWidth + 2 &&
        style.overflowX === 'hidden' &&
        style.textOverflow !== 'ellipsis'
      ) {
        found.push(`clipped text: ${element.textContent?.trim().slice(0, 32) ?? element.tagName}`)
      }
    })

    document.querySelectorAll<HTMLElement>('button, input, textarea, select, img').forEach((element) => {
      if (!isRendered(element) || element.classList.contains('sr-only')) return
      const box = element.getBoundingClientRect()

      if (!Number.isFinite(box.width) || !Number.isFinite(box.height) || box.height > viewportHeight * 2.5) {
        found.push(`abnormal geometry: ${element.getAttribute('aria-label') ?? element.tagName}`)
      }
    })

    document.querySelectorAll<HTMLElement>('body *').forEach((element) => {
      const style = window.getComputedStyle(element)

      if (style.position !== 'fixed' || !isRendered(element)) return
      const box = element.getBoundingClientRect()

      if (box.left < -1 || box.right > viewportWidth + 1) {
        found.push(`fixed element outside viewport: ${element.getAttribute('aria-label') ?? element.className ?? element.tagName}`)
      }
    })

    const bottomNavigation = document.querySelector<HTMLElement>('.moodi-common-bottom-navigation')

    if (bottomNavigation && main && isRendered(bottomNavigation)) {
      const navigationBox = bottomNavigation.getBoundingClientRect()
      const mainBottomPadding = Number.parseFloat(window.getComputedStyle(main).paddingBottom)

      if (navigationBox.left < -1 || navigationBox.right > viewportWidth + 1 || navigationBox.bottom > viewportHeight + 1) {
        found.push('bottom navigation outside viewport')
      }
      const hasDedicatedAIComposer = Boolean(document.querySelector('.ai-composer'))

      if (!hasDedicatedAIComposer && mainBottomPadding + 1 < navigationBox.height) {
        found.push(`main bottom padding is smaller than navigation (${Math.round(mainBottomPadding)} < ${Math.round(navigationBox.height)})`)
      }
    }

    const aiComposer = document.querySelector<HTMLElement>('.ai-composer')

    if (aiComposer && bottomNavigation && isRendered(aiComposer) && isRendered(bottomNavigation)) {
      const composerBox = aiComposer.getBoundingClientRect()
      const navigationBox = bottomNavigation.getBoundingClientRect()

      if (composerBox.bottom > navigationBox.top + 1) {
        found.push('AI composer overlaps bottom navigation')
      }
    }

    const mobileHeader = document.querySelector<HTMLElement>('.moodi-common-mobile-header')

    if (mobileHeader && main && isRendered(mobileHeader)) {
      const headerBox = mobileHeader.getBoundingClientRect()
      const mainTopPadding = Number.parseFloat(window.getComputedStyle(main).paddingTop)

      if (mainTopPadding + 1 < headerBox.height) {
        found.push(`main top padding is smaller than app bar (${Math.round(mainTopPadding)} < ${Math.round(headerBox.height)})`)
      }
    }

    return found
  })

  expect(issues, issues.join('\n')).toEqual([])
}

/** 모바일에서 text-like 입력이 iOS 자동 확대를 막는 16px 이상인지 확인한다. */
export async function expectMobileInputFontSize(page: Page): Promise<void> {
  if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) > 900) return

  const undersizedInputs = await page
    .locator('input, textarea, select')
    .evaluateAll((elements) => elements.flatMap((element) => {
      const input = element as HTMLInputElement
      const style = window.getComputedStyle(input)
      const box = input.getBoundingClientRect()
      const excludedTypes = new Set(['checkbox', 'radio', 'range', 'file', 'color', 'hidden'])
      const isHidden =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        box.width === 0 ||
        box.height === 0 ||
        input.classList.contains('sr-only') ||
        Boolean(input.closest('.sr-only')) ||
        excludedTypes.has(input.type)

      if (isHidden) return []

      const fontSize = Number.parseFloat(style.fontSize)

      return fontSize >= 15.9
        ? []
        : [{
            name: input.getAttribute('aria-label') ?? input.getAttribute('placeholder') ?? input.tagName,
            fontSize,
          }]
    }))

  expect(undersizedInputs, JSON.stringify(undersizedInputs, null, 2)).toEqual([])
}

/** visual viewport와 fixed mobile chrome이 서로 침범하지 않는지 확인한다. */
export async function expectVisualViewportLayout(page: Page): Promise<void> {
  if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) > 900) return

  const result = await page.evaluate(() => {
    const visualViewport = window.visualViewport
    const viewportTop = visualViewport?.offsetTop ?? 0
    const viewportBottom = viewportTop + (visualViewport?.height ?? window.innerHeight)
    const visible = (element: HTMLElement | null) => {
      if (!element) return false
      const style = window.getComputedStyle(element)
      const box = element.getBoundingClientRect()

      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0
    }
    const selectors = [
      '.moodi-common-mobile-header',
      '.moodi-common-bottom-navigation',
      '.ai-composer',
      '.mobile-block-editor-toolbar',
    ]
    const issues = selectors.flatMap((selector) => {
      const element = document.querySelector<HTMLElement>(selector)

      if (!visible(element) || !element) return []
      const box = element.getBoundingClientRect()

      return box.top < viewportTop - 1 || box.bottom > viewportBottom + 1
        ? [`${selector} outside visual viewport: ${Math.round(box.top)}-${Math.round(box.bottom)} / ${Math.round(viewportTop)}-${Math.round(viewportBottom)}`]
        : []
    })

    return { issues, viewportHeight: visualViewport?.height ?? window.innerHeight }
  })

  expect(result.viewportHeight).toBeGreaterThan(0)
  expect(result.issues, result.issues.join('\n')).toEqual([])
}

/** 900px 이하에서 보이는 모든 사용자 조작 요소가 최소 44px hit area를 갖는지 검사한다. */
export async function expectMobileTouchTargets(page: Page): Promise<void> {
  if ((page.viewportSize()?.width ?? Number.POSITIVE_INFINITY) > 900) return

  const undersizedTargets = await page.locator('button, input, textarea, select, summary, [role="button"]').evaluateAll((elements) =>
    elements.flatMap((element) => {
      const htmlElement = element as HTMLElement
      const style = window.getComputedStyle(htmlElement)
      const box = htmlElement.getBoundingClientRect()
      const isHidden =
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        box.width === 0 ||
        box.height === 0 ||
        (style.position === 'absolute' && box.width <= 1 && box.height <= 1) ||
        htmlElement.classList.contains('sr-only') ||
        Boolean(htmlElement.closest('.sr-only'))

      // CSS 44px controls can resolve to 43.99px at fractional browser scale factors.
      if (isHidden || (box.width >= 43.5 && box.height >= 43.5)) return []

      return [{
        name: htmlElement.getAttribute('aria-label') ?? htmlElement.textContent?.trim().slice(0, 32) ?? htmlElement.tagName,
        width: Math.round(box.width * 10) / 10,
        height: Math.round(box.height * 10) / 10,
      }]
    }),
  )

  expect(undersizedTargets, JSON.stringify(undersizedTargets, null, 2)).toEqual([])
}
