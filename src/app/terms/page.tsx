import Link from 'next/link'
import LegalPage from '@/components/LegalPage'
import { CONTACT_EMAIL, SERVICE_NAME } from '@/components/SiteChrome'

export const metadata = { title: `이용약관 · ${SERVICE_NAME}` }

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" updated="2026-10-04">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        이 문서는 서비스 시범 운영을 위한 초안이며, 정식 서비스 전 법률 검토를 거쳐 개정될 수 있습니다. 개정 시 시행 7일 전(이용자에게 불리한 변경은 30일
        전)에 서비스 화면으로 알립니다.
      </p>

      <h2>제1조 (목적)</h2>
      <p>
        이 약관은 {SERVICE_NAME}(이하 &ldquo;서비스&rdquo;)이 제공하는 가족 서재 관리·독서 기록·동네 책 공유 서비스의 이용 조건과 절차, 이용자와 운영자의
        권리·의무를 정합니다.
      </p>

      <h2>제2조 (용어)</h2>
      <ul>
        <li>&ldquo;이용자&rdquo;: 구글 계정으로 로그인해 서비스를 이용하는 사람</li>
        <li>&ldquo;서재(가구)&rdquo;: 이용자가 만든 책 관리 단위. 만든 이용자가 소유자가 됩니다.</li>
        <li>&ldquo;가족 구성원&rdquo;: 서재 소유자·관리자의 초대로 서재에 참여한 이용자(역할: 소유자·관리자·구성원·아이)</li>
        <li>&ldquo;동네&rdquo;: 여러 서재가 &lsquo;대여 가능&rsquo; 책을 서로 공개하는 지역 모임. &ldquo;동네 이웃&rdquo;은 동네 초대로 참여한 이용자</li>
      </ul>

      <h2>제3조 (가입과 계정)</h2>
      <ul>
        <li>별도 회원가입 없이 구글 계정으로 처음 로그인할 때 이용 계약이 성립합니다.</li>
        <li>계정 관리 책임은 이용자에게 있으며, 타인의 계정을 쓰거나 초대 링크를 무단으로 퍼뜨려서는 안 됩니다.</li>
        <li>만 14세 미만 아동은 보호자가 서재에 &lsquo;계정 없는 구성원&rsquo;으로 등록해 대신 기록하는 방식을 권장합니다.</li>
      </ul>

      <h2>제4조 (서비스 내용과 요금)</h2>
      <ul>
        <li>책 등록·위치 관리·검색, 읽기 기록·독후감, 취향 대시보드, 추천, 가족·동네 초대, 동네 대여 요청 기능을 제공합니다.</li>
        <li>
          현재 모든 기능은 무료입니다. 유료 요금제를 도입할 경우 <Link href="/pricing" className="underline">요금 안내</Link>에 미리 공지하며, 이용자가
          동의하지 않으면 요금이 부과되지 않습니다.
        </li>
        <li>도서 구매 링크에는 제휴(어필리에이트) 코드가 포함될 수 있으며, 이 경우 화면에 표시합니다.</li>
      </ul>

      <h2>제5조 (이용자의 게시물)</h2>
      <ul>
        <li>독후감·메모·사진 등 이용자가 남긴 기록의 권리는 작성한 이용자에게 있습니다.</li>
        <li>운영자는 서비스 제공(저장·표시·백업)에 필요한 범위에서만 이를 이용합니다.</li>
        <li>타인의 권리를 침해하거나 법령에 어긋나는 게시물은 사전 통지 없이 숨기거나 삭제할 수 있습니다.</li>
      </ul>

      <h2>제6조 (동네 대여)</h2>
      <ul>
        <li>동네 대여는 이용자 간의 자율적인 약속이며, 운영자는 대여 요청·승인 기록 기능만 제공합니다.</li>
        <li>책의 분실·훼손 등 대여 과정에서 생긴 분쟁은 당사자 간에 해결하는 것을 원칙으로 합니다.</li>
      </ul>

      <h2>제7조 (서비스 변경·중단)</h2>
      <p>
        운영자는 서비스 개선을 위해 기능을 바꾸거나, 점검·장애 시 서비스를 일시 중단할 수 있습니다. 서비스를 종료할 때에는 30일 전에 알리고, 이용자가
        자신의 데이터(CSV 등)를 내려받을 수 있도록 합니다.
      </p>

      <h2>제8조 (탈퇴와 데이터 삭제)</h2>
      <p>
        이용자는 언제든 서재에서 나가거나 계정 삭제를 요청할 수 있습니다(<a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>).
        처리 기준은 <Link href="/privacy" className="underline">개인정보처리방침</Link>을 따릅니다.
      </p>

      <h2>제9조 (책임의 한계)</h2>
      <p>
        외부 도서 정보(카카오, 국립중앙도서관, 도서관 정보나루, Google Books, 공공데이터포털 등)의 정확성은 각 제공기관에 따르며, 운영자는 고의 또는 중대한
        과실이 없는 한 그로 인한 손해에 책임을 지지 않습니다.
      </p>

      <h2>제10조 (문의)</h2>
      <p>
        서비스 운영·개발: {SERVICE_NAME} 개발자 · <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  )
}
