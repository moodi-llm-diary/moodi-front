export type AuthUser = {
  id: string
  email: string
  displayName: string
  joinedAt: string
  lastLoginAt: string
}

export type LoginFormState = {
  email: string
  password: string
}

export type AuthValidationResult =
  | {
      isValid: true
    }
  | {
      isValid: false
      message: string
    }

export type MyPageViewModel = {
  displayName: string
  email: string
  joinedDateLabel: string
  lastLoginDateLabel: string
}
