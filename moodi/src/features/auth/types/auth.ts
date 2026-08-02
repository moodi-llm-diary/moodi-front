export type AuthUser = {
  id: string
  email: string
  displayName: string
  joinedAt: string
  lastLoginAt: string
}

export type AuthIntent = 'login' | 'signup'

export type GoogleAuthenticationRequest = {
  intent: AuthIntent
}

export type MyPageViewModel = {
  displayName: string
  email: string
  joinedDateLabel: string
  lastLoginDateLabel: string
}
