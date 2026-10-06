import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'

/**
 * Claude API 연동(책등 사진 판독, 추천 선정). ANTHROPIC_API_KEY가 없으면 기능만 꺼지고
 * 나머지 서비스는 그대로 동작한다.
 *
 * 모델은 ANTHROPIC_MODEL로 바꿀 수 있다(기본 claude-opus-5-5).
 * 안전 분류기가 요청을 거절할 경우를 대비해 서버측 fallback("default")을 켜 둔다.
 */
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5'
const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

export function isClaudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

let client: Anthropic | null = null
function getClient() {
  client ??= new Anthropic({ timeout: 120_000 })
  return client
}

export class ClaudeError extends Error {}

const SpineSchema = z.object({
  books: z.array(
    z.object({
      title: z.string().describe('책등에 보이는 제목 그대로(부제 제외)'),
      author: z.string().describe('보이면 저자, 안 보이면 빈 문자열'),
      publisher: z.string().describe('보이면 출판사, 안 보이면 빈 문자열'),
      volume: z.number().int().nullable().describe('시리즈 권차 번호가 보이면 그 숫자, 아니면 null'),
      confidence: z.enum(['high', 'medium', 'low']).describe('제목 판독 확신도'),
    }),
  ),
})

export type SpineBook = z.infer<typeof SpineSchema>['books'][number]

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

/** 서가 칸 사진 1장 → 책등 목록(왼쪽에서 오른쪽 순서). */
export async function readShelfPhoto(base64: string, mediaType: ImageMediaType): Promise<SpineBook[]> {
  const res = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(SpineSchema) },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          {
            type: 'text',
            text:
              '가정집 책장 한 칸을 찍은 사진입니다. 세워 꽂힌 책의 책등을 왼쪽에서 오른쪽 순서로 읽어 목록을 만들어 주세요.\n' +
              '- 책등 글자가 실제로 읽히는 책만 넣고, 추측으로 제목을 지어내지 마세요. 흐리면 confidence를 low로 두세요.\n' +
              '- 위에 눕혀 쌓인 책도 제목이 보이면 포함하세요. 책이 아닌 물건(장난감, 상자 등)은 빼세요.\n' +
              '- 전집·시리즈는 권마다 한 줄씩, 권차 번호를 volume에 넣으세요.',
          },
        ],
      },
    ],
  })
  if (res.stop_reason === 'refusal') throw new ClaudeError('AI가 이 사진의 처리를 거절했습니다.')
  if (!res.parsed_output) throw new ClaudeError('AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.')
  return res.parsed_output.books
}

const PickSchema = z.object({
  picks: z.array(
    z.object({
      index: z.number().int().describe('후보 목록의 번호'),
      reason: z.string().describe('이 사람에게 추천하는 이유, 한국어 한 문장(60자 이내)'),
    }),
  ),
})

export interface PickInput {
  memberName: string
  isChild: boolean
  profileSummary: string
  recentNotes: string[]
  candidates: { title: string; authors: string; publisher: string; source: string }[]
  limit: number
}

/** 후보 중에서 최대 limit권을 골라 이유를 붙인다. 후보에 없는 책은 고를 수 없다(index로만 응답). */
export async function pickRecommendations(input: PickInput): Promise<{ index: number; reason: string }[]> {
  const list = input.candidates
    .map((c, i) => `${i}. ${c.title} — ${c.authors || '저자 미상'} (${c.publisher || '출판사 미상'}) [출처: ${c.source}]`)
    .join('\n')
  const res = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(PickSchema) },
    system:
      '당신은 가족 서재의 사서입니다. 주어진 후보 목록 안에서만 골라, 독자의 취향 기록에 비추어 다음에 읽거나 살 만한 책을 추천합니다. ' +
      '이미 읽은 책과 너무 비슷한 책만 고르지 말고, 취향의 중심과 한 걸음 옆을 섞어 주세요.',
    messages: [
      {
        role: 'user',
        content:
          `독자: ${input.memberName}${input.isChild ? ' (어린이 — 연령에 맞는 책만)' : ''}\n\n` +
          `취향 요약:\n${input.profileSummary}\n\n` +
          (input.recentNotes.length ? `최근 독후감·메모 발췌:\n${input.recentNotes.map((n) => `- ${n}`).join('\n')}\n\n` : '') +
          `후보 목록:\n${list}\n\n최대 ${input.limit}권을 골라 주세요.`,
      },
    ],
  })
  if (res.stop_reason === 'refusal' || !res.parsed_output) return []
  const seen = new Set<number>()
  return res.parsed_output.picks
    .filter((p) => p.index >= 0 && p.index < input.candidates.length && !seen.has(p.index) && seen.add(p.index))
    .slice(0, input.limit)
}
