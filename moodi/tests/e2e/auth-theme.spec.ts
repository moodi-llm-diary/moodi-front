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
