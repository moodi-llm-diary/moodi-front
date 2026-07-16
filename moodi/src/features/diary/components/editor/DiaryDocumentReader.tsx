import { createDiaryDocumentHtml } from '../../services/diaryDocumentService'

type DiaryDocumentReaderProps = {
  content?: string
  contentHtml?: string
}

/** 저장된 TipTap 문서를 편집 도구 없이 같은 시각 언어로 읽는다. */
export function DiaryDocumentReader({ content = '', contentHtml }: DiaryDocumentReaderProps) {
  const documentHtml = createDiaryDocumentHtml(contentHtml, content)

  return (
    <div
      aria-label="일기 본문"
      className="moodi-prosemirror moodi-prosemirror-reader"
      // contentHtml은 Repository의 허용 태그/속성 및 이미지 URL 검증을 통과한 문서만 전달된다.
      dangerouslySetInnerHTML={{ __html: documentHtml }}
    />
  )
}
