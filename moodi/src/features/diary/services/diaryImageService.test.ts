import { describe, expect, it } from 'vitest'
import type { DiaryImage } from '../types/diary'
import {
  getDiaryCoverImage,
  getStandaloneDiaryImages,
} from './diaryImageService'

const cover: DiaryImage = { id: 'cover', role: 'cover', url: 'data:image/webp;base64,cover' }
const inline: DiaryImage = { id: 'inline', role: 'inline', url: 'data:image/webp;base64,inline' }
const legacy: DiaryImage = { id: 'legacy', url: 'data:image/webp;base64,legacy' }

describe('diaryImageService', () => {
  it('명시 cover를 본문 밖 이미지로 우선한다', () => {
    const source = {
      images: [inline, cover],
      contentHtml: `<p>본문</p><img src="${inline.url}">`,
    }

    expect(getStandaloneDiaryImages(source)).toEqual([cover])
    expect(getDiaryCoverImage(source)).toEqual(cover)
  })

  it('role 도입 전 이미지는 본문 HTML 참조 여부로 구분한다', () => {
    const source = {
      images: [legacy, inline],
      contentHtml: `<p>본문</p><img src="${inline.url}">`,
    }

    expect(getStandaloneDiaryImages(source)).toEqual([legacy])
    expect(getDiaryCoverImage(source)).toEqual(legacy)
  })

  it('cover가 없으면 본문 이미지를 목록 thumbnail로 사용한다', () => {
    const source = {
      images: [legacy],
      contentHtml: `<p>본문</p><img src="${legacy.url}">`,
    }

    expect(getStandaloneDiaryImages(source)).toEqual([])
    expect(getDiaryCoverImage(source)).toEqual(legacy)
  })
})
