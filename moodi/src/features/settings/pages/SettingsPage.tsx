import {
  Brain,
  CalendarDays,
  Camera,
  ChevronRight,
  CloudSun,
  Code2,
  Download,
  Folder,
  Link2Off,
  Lock,
  Music2,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
  Type,
  Upload,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { useRef } from 'react'
import type { ChangeEvent } from 'react'
import { ThemeSelector } from '../../theme/components/ThemeSelector'
import type { ThemeName, ThemeOption } from '../../theme/types/theme'
import { useSettingsPreferences } from '../hooks/useSettingsPreferences'
import type { ExternalDataSource } from '../types/settings'
import './SettingsPage.css'

export type SettingsPageProps = {
  activeTheme: ThemeName
  themeOptions: ThemeOption[]
  onSelectTheme: (themeName: ThemeName) => boolean
  onExport: () => Promise<void> | void
  onImportFile: (file: File) => Promise<void> | void
  onDeleteAll: () => Promise<void> | void
  onOpenTags: () => void
  onOpenProfile: () => void
  onToast: (message: string, tone?: 'success' | 'info' | 'error') => void
}

const externalDataIcons: Record<ExternalDataSource, LucideIcon> = {
  photos: Camera,
  calendar: CalendarDays,
  music: Music2,
  weather: CloudSun,
  projects: Folder,
  github: Code2,
}

/**
 * 사용자 preference를 표시하고 데이터 관리 의도를 상위 경계에 전달한다.
 */
export function SettingsPage({
  activeTheme,
  themeOptions,
  onSelectTheme,
  onExport,
  onImportFile,
  onDeleteAll,
  onOpenTags,
  onOpenProfile,
  onToast,
}: SettingsPageProps) {
  const settings = useSettingsPreferences()
  const importInputRef = useRef<HTMLInputElement>(null)

  const notifyPreferenceResult = (isSaved: boolean) => {
    onToast(
      isSaved
        ? '설정을 저장했어요.'
        : settings.persistenceError ?? '설정을 저장하지 못했어요.',
      isSaved ? 'success' : 'error',
    )
  }

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.currentTarget.files?.[0]

    event.currentTarget.value = ''

    if (!selectedFile) {
      return
    }

    runDataCallback(
      () => onImportFile(selectedFile),
      '데이터를 가져오지 못했어요. 파일 내용을 확인해 주세요.',
      onToast,
    )
  }

  return (
    <section
      aria-labelledby="settings-page-title"
      className="settings-page"
    >
      <header className="settings-page-header">
        <div>
          <span className="settings-eyebrow">나의 기록 공간</span>
          <h1 id="settings-page-title">설정</h1>
          <p>기록을 읽고 돌아보는 방식을 나에게 맞게 조절해 보세요.</p>
        </div>
      </header>

      <div className="settings-layout">
        <div className="settings-column">
          <details aria-labelledby="settings-appearance-title" className="settings-card" open>
            <summary className="settings-card-heading">
              <Type aria-hidden="true" size={19} />
              <div>
                <h2 id="settings-appearance-title">화면과 글자</h2>
                <p>앱의 색감과 기록을 읽는 글자 크기를 선택해요.</p>
              </div>
            </summary>

            <ThemeSelector
              activeTheme={activeTheme}
              onSelectTheme={(themeName) => {
                const isSaved = onSelectTheme(themeName)
                onToast(
                  isSaved
                    ? '테마를 변경했어요.'
                    : '브라우저에 테마를 저장하지 못했어요.',
                  isSaved ? 'success' : 'error',
                )
              }}
              options={themeOptions}
            />

            <fieldset className="settings-fieldset">
              <legend>글꼴 크기</legend>
              <div className="settings-choice-grid settings-choice-grid-three">
                {settings.fontSizeOptions.map((option) => (
                  <label
                    className={`settings-choice ${
                      settings.preferences.fontSize === option.value ? 'selected' : ''
                    }`}
                    key={option.value}
                  >
                    <input
                      checked={settings.preferences.fontSize === option.value}
                      className="settings-choice-input"
                      name="settings-font-size"
                      onChange={() => notifyPreferenceResult(settings.setFontSize(option.value))}
                      type="radio"
                      value={option.value}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          </details>

          <details aria-labelledby="settings-privacy-title" className="settings-card">
            <summary className="settings-card-heading">
              <Lock aria-hidden="true" size={19} />
              <div>
                <h2 id="settings-privacy-title">기록과 개인정보</h2>
                <p>새 기록의 기본 잠금 상태를 정해요.</p>
              </div>
            </summary>

            <label className="settings-toggle-row">
              <span>
                <strong>새 일기를 기본으로 잠그기</strong>
                <small>작성 화면을 열 때 잠금 상태를 기본값으로 사용해요.</small>
              </span>
              <input
                checked={settings.preferences.isEntryLockEnabledByDefault}
                onChange={(event) =>
                  notifyPreferenceResult(
                    settings.setEntryLockEnabledByDefault(event.target.checked),
                  )
                }
                type="checkbox"
              />
              <span aria-hidden="true" className="settings-switch" />
            </label>

            <div className="settings-privacy-note">
              <ShieldCheck aria-hidden="true" size={18} />
              <p>
                현재 잠금은 앱 안에 잠금 표시를 남기는 사용자 설정이며, 본문을 숨기거나
                암호화하지 않습니다.
              </p>
            </div>
          </details>
        </div>

        <div className="settings-column">
          <details aria-labelledby="settings-ai-title" className="settings-card">
            <summary className="settings-card-heading">
              <Brain aria-hidden="true" size={19} />
              <div>
                <h2 id="settings-ai-title">Moodi의 기록 도움</h2>
                <p>기록 뒤에 남기는 짧은 한마디와 질문 방식을 선택해요.</p>
              </div>
            </summary>

            <label className="settings-toggle-row">
              <span>
                <strong>Moodi의 기록 도움 사용</strong>
                <small>켜 둔 동안 새로 저장하거나 수정하는 기록에 요약, 주제와 질문을 만들어요.</small>
              </span>
              <input
                checked={settings.preferences.isAiAnalysisEnabled}
                onChange={(event) =>
                  notifyPreferenceResult(
                    settings.setAiAnalysisEnabled(event.target.checked),
                  )
                }
                type="checkbox"
              />
              <span aria-hidden="true" className="settings-switch" />
            </label>

            <fieldset
              className="settings-fieldset"
              disabled={!settings.preferences.isAiAnalysisEnabled}
            >
              <legend>한마디의 말투</legend>
              <div className="settings-choice-grid settings-choice-grid-two">
                {settings.aiToneOptions.map((option) => (
                  <label
                    className={`settings-choice ${
                      settings.preferences.aiTone === option.value ? 'selected' : ''
                    }`}
                    key={option.value}
                  >
                    <input
                      checked={settings.preferences.aiTone === option.value}
                      className="settings-choice-input"
                      name="settings-ai-tone"
                      onChange={() => notifyPreferenceResult(settings.setAiTone(option.value))}
                      type="radio"
                      value={option.value}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset
              className="settings-fieldset"
              disabled={!settings.preferences.isAiAnalysisEnabled}
            >
              <legend>한마디의 길이</legend>
              <div className="settings-choice-grid settings-choice-grid-three">
                {settings.aiResponseLengthOptions.map((option) => (
                  <label
                    className={`settings-choice ${
                      settings.preferences.aiResponseLength === option.value
                        ? 'selected'
                        : ''
                    }`}
                    key={option.value}
                  >
                    <input
                      checked={settings.preferences.aiResponseLength === option.value}
                      className="settings-choice-input"
                      name="settings-ai-response-length"
                      onChange={() =>
                        notifyPreferenceResult(
                          settings.setAiResponseLength(option.value),
                        )
                      }
                      type="radio"
                      value={option.value}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="settings-toggle-row">
              <span>
                <strong>개인화 질문 사용</strong>
                <small>최근 기록과 현재 상태를 참고한 질문을 제안해요.</small>
              </span>
              <input
                checked={settings.preferences.isPersonalizedQuestionsEnabled}
                disabled={!settings.preferences.isAiAnalysisEnabled}
                onChange={(event) =>
                  notifyPreferenceResult(
                    settings.setPersonalizedQuestionsEnabled(event.target.checked),
                  )
                }
                type="checkbox"
              />
              <span aria-hidden="true" className="settings-switch" />
            </label>

            <div className="settings-ai-notice">
              <Sparkles aria-hidden="true" size={17} />
              <p>
                Moodi가 남기는 한마디는 기록을 돌아보는 보조 정보이며 의료 상담이나 정신 건강
                진단을 제공하지 않습니다.
              </p>
            </div>
          </details>
        </div>
      </div>

      <section className="settings-navigation-section" aria-labelledby="settings-account-title">
        <button className="settings-link-row" onClick={onOpenProfile} type="button">
          <UserRound aria-hidden="true" size={19} />
          <span>
            <strong id="settings-account-title">계정</strong>
            <small>프로필과 로그인 상태를 확인해요.</small>
          </span>
          <ChevronRight aria-hidden="true" size={19} />
        </button>
      </section>

      <section className="settings-navigation-section" aria-labelledby="settings-tags-title">
        <button className="settings-link-row" onClick={onOpenTags} type="button">
          <Tags aria-hidden="true" size={19} />
          <span>
            <strong id="settings-tags-title">태그와 주제</strong>
            <small>기록에 남긴 단서를 모아 다시 찾아봐요.</small>
          </span>
          <ChevronRight aria-hidden="true" size={19} />
        </button>
      </section>

      <details aria-labelledby="settings-connections-title" className="settings-card">
        <summary className="settings-card-heading">
          <Link2Off aria-hidden="true" size={19} />
          <div>
            <h2 id="settings-connections-title">외부 데이터 연결</h2>
            <p>연결 전에는 어떤 데이터도 자동으로 수집하지 않아요.</p>
          </div>
        </summary>

        <div className="settings-connection-grid">
          {settings.externalDataConnectionOptions.map((connectionOption) => {
            const ConnectionIcon = externalDataIcons[connectionOption.source]
            const descriptionId = `settings-connection-${connectionOption.source}`

            return (
              <article className="settings-connection-card" key={connectionOption.source}>
                <div className="settings-connection-icon">
                  <ConnectionIcon aria-hidden="true" size={19} />
                </div>
                <div>
                  <div className="settings-connection-title-row">
                    <h3>{connectionOption.label}</h3>
                    <span>미연결</span>
                  </div>
                  <p>{connectionOption.description}</p>
                  <small id={descriptionId}>{connectionOption.consentDescription}</small>
                </div>
                <button
                  aria-describedby={descriptionId}
                  disabled
                  title="외부 서비스 계약이 확정되면 동의 화면과 함께 제공됩니다."
                  type="button"
                >
                  연결 준비 중
                </button>
              </article>
            )
          })}
        </div>

        <p className="settings-contract-note">
          외부 서비스의 인증 범위와 데이터 계약이 확정된 뒤, 명시적인 동의 화면을 먼저
          제공할 예정입니다.
        </p>
        {/* TODO: provider별 OAuth/SDK endpoint, consent scope, response field, timeout,
            retry, failure mapping 계약 확정 후 연결 action을 활성화한다. */}
      </details>

      <details aria-labelledby="settings-data-title" className="settings-card settings-data-card">
        <summary className="settings-card-heading">
          <Download aria-hidden="true" size={19} />
          <div>
            <h2 id="settings-data-title">내 데이터 관리</h2>
            <p>기록을 JSON 파일로 보관하거나 이전 데이터를 다시 가져올 수 있어요.</p>
          </div>
        </summary>

        <div className="settings-data-actions">
          <button
            className="settings-action-button"
            onClick={() =>
              runDataCallback(
                onExport,
                '데이터를 내보내지 못했어요. 잠시 후 다시 시도해 주세요.',
                onToast,
              )
            }
            type="button"
          >
            <Download aria-hidden="true" size={18} />
            데이터 내보내기
          </button>
          <button
            className="settings-action-button"
            onClick={() => importInputRef.current?.click()}
            type="button"
          >
            <Upload aria-hidden="true" size={18} />
            데이터 가져오기
          </button>
          <input
            accept="application/json,.json"
            aria-label="가져올 Moodi JSON 데이터 파일"
            className="settings-file-input"
            onChange={handleImportFileChange}
            ref={importInputRef}
            tabIndex={-1}
            type="file"
          />
          <button
            className="settings-action-button settings-danger-button"
            onClick={() =>
              runDataCallback(
                onDeleteAll,
                '전체 데이터를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.',
                onToast,
              )
            }
            type="button"
          >
            <Trash2 aria-hidden="true" size={18} />
            전체 Moodi 데이터 삭제
          </button>
        </div>

        <p className="settings-data-warning">
          저장된 기록, 임시저장, 로컬 프로필, 테마와 앱 설정을 모두 지웁니다. 브라우저
          밖으로 내보낸 파일은 삭제되지 않으며, 삭제한 데이터는 복구할 수 없습니다.
        </p>
      </details>

      <details aria-labelledby="settings-data-privacy-title" className="settings-card">
        <summary className="settings-card-heading">
          <ShieldCheck aria-hidden="true" size={19} />
          <div>
            <h2 id="settings-data-privacy-title">개인정보 처리 안내</h2>
            <p>현재 로컬 MVP가 기록을 보관하고 사용하는 범위를 안내해요.</p>
          </div>
        </summary>

        <dl className="settings-privacy-disclosure">
          <div>
            <dt>저장 위치</dt>
            <dd>일기, 임시저장, 설정과 mock 프로필은 현재 브라우저의 localStorage에 저장됩니다.</dd>
          </div>
          <div>
            <dt>처리 목적</dt>
            <dd>기록 복구, 검색·통계, 관련 기억 연결과 사용자가 켠 로컬 규칙 분석에만 사용합니다.</dd>
          </div>
          <div>
            <dt>외부 전송</dt>
            <dd>현재 백엔드나 외부 AI로 전송하지 않습니다. 외부 연결은 모두 미연결 상태입니다.</dd>
          </div>
          <div>
            <dt>보존과 삭제</dt>
            <dd>사용자가 직접 삭제하거나 브라우저 저장소를 지울 때까지 보관되며, 위 전체 삭제로 한 번에 제거할 수 있습니다.</dd>
          </div>
        </dl>
      </details>
    </section>
  )
}

function runDataCallback(
  callback: () => Promise<void> | void,
  errorMessage: string,
  onToast: (message: string, tone?: 'success' | 'info' | 'error') => void,
): void {
  try {
    void Promise.resolve(callback()).catch(() => onToast(errorMessage, 'error'))
  } catch {
    onToast(errorMessage, 'error')
  }
}
