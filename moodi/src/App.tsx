import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useAuthStore } from './features/auth/stores/authStore'
import { LoginPage } from './features/auth/pages/LoginPage'
import { MyPage } from './features/auth/pages/MyPage'
import { DiaryMvpPage } from './features/diary/pages/DiaryMvpPage'
import { useThemePreference } from './features/theme/hooks/useThemePreference'
import { useSettingsStore } from './features/settings/stores/settingsStore'
import { useMoodiDataReset } from './features/settings/hooks/useMoodiDataReset'

type AppRoute = 'diary' | 'login' | 'myPage'

function App() {
  const [appRoute, setAppRoute] = useState<AppRoute>(() => readAppRouteFromHistory())
  const currentUser = useAuthStore((state) => state.currentUser)
  const fontSize = useSettingsStore((state) => state.preferences.fontSize)
  const themePreference = useThemePreference()
  const resetProfileAndPreferences = useMoodiDataReset()
  const previousAppRouteRef = useRef(appRoute)

  useLayoutEffect(() => {
    document.documentElement.dataset.moodiTheme = themePreference.activeTheme
    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previousThemeColor = themeColorMeta?.content
    const canvasColor = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue('--color-canvas')
      .trim()

    if (themeColorMeta && canvasColor) themeColorMeta.content = canvasColor

    return () => {
      delete document.documentElement.dataset.moodiTheme
      if (themeColorMeta && previousThemeColor) themeColorMeta.content = previousThemeColor
    }
  }, [themePreference.activeTheme])

  useEffect(() => {
    const handlePopState = () => setAppRoute(readAppRouteFromHistory())

    window.addEventListener('popstate', handlePopState)

    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.moodiFontSize = fontSize

    return () => {
      delete document.documentElement.dataset.moodiFontSize
    }
  }, [fontSize])

  useEffect(() => {
    if (previousAppRouteRef.current === appRoute) return

    previousAppRouteRef.current = appRoute
    const frameId = window.requestAnimationFrame(() => {
      const focusTarget =
        appRoute === 'diary'
          ? document.getElementById('moodi-main-content')
          : document.querySelector<HTMLElement>('.auth-app')

      focusTarget?.focus()
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [appRoute])

  const openAppRoute = (route: Exclude<AppRoute, 'diary'>) => {
    window.history.pushState(
      { ...readHistoryState(), moodiAppRoute: route },
      '',
      window.location.href,
    )
    setAppRoute(route)
  }

  const replaceAppRoute = (route: Exclude<AppRoute, 'diary'>) => {
    window.history.replaceState(
      { ...readHistoryState(), moodiAppRoute: route },
      '',
      window.location.href,
    )
    setAppRoute(route)
  }

  const closeAppRoute = () => {
    if (readHistoryState().moodiAppRoute && window.history.length > 1) {
      window.history.back()
      return
    }

    window.history.replaceState({}, '', window.location.href)
    setAppRoute('diary')
  }

  let content: ReactNode

  if (appRoute === 'login') {
    content = (
      <LoginPage
        activeTheme={themePreference.activeTheme}
        onSelectTheme={themePreference.setActiveTheme}
        onBack={closeAppRoute}
        onLoginSuccess={closeAppRoute}
        themeOptions={themePreference.themeOptions}
      />
    )
  } else if (appRoute === 'myPage') {
    content = (
      <MyPage
        activeTheme={themePreference.activeTheme}
        onBack={closeAppRoute}
        onLoggedOut={closeAppRoute}
        onLogin={() => replaceAppRoute('login')}
        onSelectTheme={themePreference.setActiveTheme}
        themeOptions={themePreference.themeOptions}
      />
    )
  } else {
    content = (
      <DiaryMvpPage
        activeTheme={themePreference.activeTheme}
        authUserLabel={currentUser?.displayName}
        onOpenLogin={() => openAppRoute('login')}
        onOpenMyPage={() => openAppRoute(currentUser ? 'myPage' : 'login')}
        onResetProfileAndPreferences={resetProfileAndPreferences}
        onSelectTheme={themePreference.setActiveTheme}
        themeOptions={themePreference.themeOptions}
      />
    )
  }

  return (
    <div
      className="moodi-theme-root"
      data-moodi-theme={themePreference.activeTheme}
    >
      {content}
    </div>
  )
}

export default App

type MoodiHistoryState = {
  moodiAppRoute?: Exclude<AppRoute, 'diary'>
}

function readHistoryState(): MoodiHistoryState {
  const value = window.history.state as unknown

  return typeof value === 'object' && value !== null
    ? (value as MoodiHistoryState)
    : {}
}

function readAppRouteFromHistory(): AppRoute {
  const route = readHistoryState().moodiAppRoute

  return route === 'login' || route === 'myPage' ? route : 'diary'
}
