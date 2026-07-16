import {
  BarChart3,
  BookOpenText,
  CalendarDays,
  Home,
  MessageCircleMore,
  Settings,
  type LucideIcon,
} from 'lucide-react'

/**
 * AppShell이 표현할 수 있는 화면 식별자다.
 *
 * URL 변환은 라우팅 계층의 책임이며 공통 navigation은 이 key만 전달한다.
 */
export type MoodiRouteKey =
  | 'home'
  | 'write'
  | 'ai'
  | 'entries'
  | 'calendar'
  | 'insights'
  | 'tags'
  | 'settings'

export type MoodiNavigationItem = {
  route: MoodiRouteKey
  label: string
  Icon: LucideIcon
}

export type MoodiNavigationProfile = {
  displayName: string
  secondaryText?: string
}

export type MoodiSidebarEntry = {
  id: string
  title: string
  meta: string
}

export const DESKTOP_NAVIGATION_ITEMS = [
  { route: 'home', label: '오늘', Icon: Home },
  { route: 'ai', label: 'AI와 대화', Icon: MessageCircleMore },
  { route: 'entries', label: '기록', Icon: BookOpenText },
  { route: 'calendar', label: '캘린더', Icon: CalendarDays },
  { route: 'insights', label: '회고', Icon: BarChart3 },
] as const satisfies readonly MoodiNavigationItem[]

export const MOBILE_NAVIGATION_ITEMS = [
  { route: 'home', label: '오늘', Icon: Home },
  { route: 'entries', label: '기록', Icon: BookOpenText },
  { route: 'ai', label: 'AI', Icon: MessageCircleMore },
  { route: 'calendar', label: '캘린더', Icon: CalendarDays },
] as const satisfies readonly MoodiNavigationItem[]

export const MOBILE_MORE_NAVIGATION_ITEMS = [
  { route: 'insights', label: '회고', Icon: BarChart3 },
  { route: 'settings', label: '설정', Icon: Settings },
] as const satisfies readonly MoodiNavigationItem[]
