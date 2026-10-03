import type { Household } from '@prisma/client'

/**
 * '우리 가족을 위한 정보' — 공공데이터(도서관·인기대출·사서추천) 위젯 자리.
 * 키가 없거나 호출이 실패하면 아무것도 그리지 않는다(best-effort). 3단계에서 채운다.
 */
export default async function FamilyInfo({ household }: { household: Pick<Household, 'regionName' | 'regionCode'> }) {
  void household
  return null
}
