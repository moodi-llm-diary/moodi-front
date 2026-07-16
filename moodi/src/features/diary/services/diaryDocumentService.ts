/**
 * Legacy 평문 일기와 TipTap 문서 HTML 사이의 호환 변환을 담당한다.
 * DOM이나 UI component에 저장 형식 변환 책임을 두지 않는다.
 */
export function createDiaryDocumentHtml(
  contentHtml: string | undefined,
  plainText: string,
): string {
  if (contentHtml?.trim()) return contentHtml

  const paragraphs = plainText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  return paragraphs.length > 0
    ? paragraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
        .join('')
    : '<p></p>'
}

/** 기존 문서 끝에 Moodi 질문을 일반 문단으로 안전하게 추가한다. */
export function appendDiaryDocumentParagraph(
  contentHtml: string | undefined,
  plainText: string,
  paragraph: string,
): string {
  const currentHtml = createDiaryDocumentHtml(contentHtml, plainText)
  const normalizedCurrentHtml = currentHtml === '<p></p>' ? '' : currentHtml

  return `${normalizedCurrentHtml}<p>${escapeHtml(paragraph)}</p>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
