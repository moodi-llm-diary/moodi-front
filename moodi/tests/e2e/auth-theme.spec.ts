import { expect, test } from '@playwright/test'

test('로그인과 회원가입은 같은 시스템 테마를 사용한다', async ({ page }) => {
  await page.route('**/api/v1/auth/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ user: null, csrfToken: null }),
      status: 200,
    })
  })

  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await page.evaluate(() => {
    window.history.replaceState({ moodiAppRoute: 'login' }, '', window.location.href)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible()
  const loginTheme = await page.locator('html').getAttribute('data-moodi-theme')

  await page.getByRole('tab', { name: '회원가입' }).click()
  await expect(page.getByRole('heading', { name: 'Moodi 시작하기', exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('data-moodi-theme', loginTheme ?? '')
  await expect(page.locator('.moodi-theme-root')).toHaveAttribute('data-moodi-theme', loginTheme ?? '')
})

test('Google 로그인은 앱 origin callback을 사용하는 popup button을 사용한다', async ({ page }) => {
  await page.addInitScript(() => {
    const browserWindow = window as unknown as {
      google: {
        accounts: {
          id: {
            cancel: () => void
            initialize: (options: {
              callback?: (response: { credential?: string }) => void
              ux_mode?: string
            }) => void
            renderButton: (parent: HTMLElement, options: unknown) => void
          }
        }
      }
      __moodiGoogleCalls: { initialize?: Record<string, unknown>; render?: Record<string, unknown> }
    }

    browserWindow.__moodiGoogleCalls = {}
    browserWindow.google = {
      accounts: {
        id: {
          cancel: () => undefined,
          initialize: (options) => {
            browserWindow.__moodiGoogleCalls.initialize = options as Record<string, unknown>
          },
          renderButton: (parent, options) => {
            browserWindow.__moodiGoogleCalls.render = options as Record<string, unknown>
            const button = document.createElement('button')
            button.type = 'button'
            button.textContent = 'Sign in with Google'
            parent.append(button)
          },
        },
      },
    }
  })

  let sessionRequestCount = 0
  let credentialRequestBody = ''
  let credentialRequestCookie = ''
  await page.route('**/api/v1/auth/session', async (route) => {
    const responseUser = sessionRequestCount > 0
      ? {
        id: 'user-1',
        email: 'user@example.com',
        displayName: 'Moodi User',
        joinedAt: '2026-01-01T00:00:00.000Z',
        lastLoginAt: '2026-01-01T00:00:00.000Z',
      }
      : null
    sessionRequestCount += 1

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ user: responseUser, csrfToken: responseUser ? 'session-csrf' : null }),
      status: 200,
    })
  })
  await page.route('**/api/v1/auth/login-attempts', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        attemptId: '00000000-0000-4000-8000-000000000001',
        expiresAt: '2099-01-01T00:00:00Z',
        nonce: 'test-nonce',
      }),
      status: 201,
    })
  })
  await page.route('**/api/v1/auth/google-credentials', async (route) => {
    credentialRequestBody = route.request().postData() ?? ''
    credentialRequestCookie = (await route.request().allHeaders()).cookie ?? ''
    await route.fulfill({
      headers: { Location: '/' },
      status: 303,
    })
  })

  await page.goto('/')
  await page.evaluate(() => {
    window.history.replaceState({ moodiAppRoute: 'login' }, '', window.location.href)
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible()
  const calls = await page.evaluate(() => (
    window as unknown as {
      __moodiGoogleCalls: {
        initialize?: {
          callback?: (response: { credential: string }) => void
          ux_mode?: string
          nonce?: string
        }
        render?: { state?: string }
      }
    }
  ).__moodiGoogleCalls)

  expect(calls.initialize).toMatchObject({
    nonce: 'test-nonce',
    ux_mode: 'popup',
  })
  expect(calls.render).toMatchObject({
    state: '00000000-0000-4000-8000-000000000001',
  })

  await page.evaluate(() => {
    const callback = (window as unknown as {
      __moodiGoogleCalls: { initialize?: { callback?: (response: { credential: string }) => void } }
    }).__moodiGoogleCalls.initialize?.callback

    callback?.({ credential: 'test-google-credential' })
  })

  await expect.poll(() => credentialRequestBody).toContain('credential=test-google-credential')
  expect(credentialRequestBody).toContain('state=00000000-0000-4000-8000-000000000001')
  expect(credentialRequestBody).toMatch(/g_csrf_token=[0-9a-f]{64}/)
  expect(credentialRequestCookie).toMatch(/g_csrf_token=[0-9a-f]{64}/)
  expect(page.url()).not.toContain('/api/v1/auth/google-credentials')
})
