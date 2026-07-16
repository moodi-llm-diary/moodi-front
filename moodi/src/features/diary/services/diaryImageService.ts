import type { DiaryImage } from '../types/diary'

export type DiaryImageSource = {
  images: DiaryImage[]
  contentHtml?: string
}

/** 저장된 문서가 이미지를 inline block으로 참조하는지 판별한다. */
export function isDiaryImageReferenced(
  image: DiaryImage,
  contentHtml?: string,
): boolean {
  return Boolean(contentHtml?.includes(image.url))
}

/**
 * 본문 밖에서 보여 줄 cover/gallery 이미지를 반환한다.
 * role 도입 전 데이터는 HTML 참조 여부로 cover와 inline을 안전하게 추론한다.
 */
export function getStandaloneDiaryImages(source: DiaryImageSource): DiaryImage[] {
  const explicitCovers = source.images.filter((image) => image.role === 'cover')
  const legacyStandaloneImages = source.images.filter(
    (image) =>
      !image.role && !isDiaryImageReferenced(image, source.contentHtml),
  )

  return [...explicitCovers, ...legacyStandaloneImages]
}

/** 목록 thumbnail은 cover를 우선하고, 없으면 첫 inline 장면을 fallback으로 사용한다. */
export function getDiaryCoverImage(source: DiaryImageSource): DiaryImage | undefined {
  return getStandaloneDiaryImages(source)[0] ?? source.images.find(
    (image) => isDiaryImageReferenced(image, source.contentHtml),
  )
}
