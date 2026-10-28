import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import Footer from '../components/Footer'
import { Logo } from '../components/Logo'
import { SITE } from '../siteConfig'

/** 로그인 없이 볼 수 있는 안내 페이지 공통 틀 */
function InfoShell({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  const { user } = useAuth()
  useEffect(() => { window.scrollTo(0, 0); document.title = `${title} · ${SITE.name}` }, [title])
  return (
    <div className="info-page">
      <header className="info-top">
        <div className="info-top-inner">
          <Link to="/"><Logo /></Link>
          <span className="spacer" />
          <Link to="/" className="btn btn-sm">오퍼 둘러보기</Link>
        </div>
      </header>
      <main className="info-main">
        <h1>{title}</h1>
        {lead && <p className="info-lead">{lead}</p>}
        <div className="info-body">{children}</div>
      </main>
      <Footer />
    </div>
  )
}

export function About() {
  return (
    <InfoShell title="서비스 소개" lead="BizBarter는 기업이 가진 재고·유휴 설비·전문 용역을 다른 기업의 재화·용역 또는 현금과 교환하는 B2B 교환 거래소입니다.">
      <section>
        <h2>이런 기업에 필요합니다</h2>
        <ul>
          <li>재고나 유휴 설비를 현금화하기 어려워 창고에 쌓아 두고 있는 기업</li>
          <li>필요한 서비스가 있지만 현금 지출을 줄이고 싶은 기업</li>
          <li>자사 기술·용역으로 새로운 거래처를 만들고 싶은 기업</li>
        </ul>
      </section>
      <section>
        <h2>거래는 이렇게 진행됩니다</h2>
        <ol className="info-steps">
          <li><b>기업 회원가입과 승인</b>기업 정보(주 사업분야, 보유기술, 사업 실적)를 등록하면 관리자가 확인 후 승인합니다.</li>
          <li><b>교환 오퍼 등록</b>대화형 도우미의 질문에 답하면 내놓을 것과 받고 싶은 것(재화·용역·현금)이 담긴 오퍼가 완성됩니다.</li>
          <li><b>AI 추천과 협상</b>기업 특성을 분석해 서로 주고받을 것이 맞는 오퍼를 추천하고, 1:1 메신저로 조건을 협상합니다.</li>
          <li><b>계약과 정산</b>합의하면 계약서가 자동 작성되고, 전자서명·에스크로 결제·이행 확인을 거쳐 거래가 완료됩니다.</li>
        </ol>
      </section>
      <section>
        <h2>주요 기능</h2>
        <ul>
          <li><b>양방향 AI 매칭</b> — 상대가 주는 것이 우리에게 필요한지, 상대가 원하는 것을 우리가 줄 수 있는지를 함께 따집니다.</li>
          <li><b>현금 혼합 거래</b> — 재화·용역만, 현금만, 또는 재화·용역과 현금을 함께 받는 교환을 모두 지원합니다.</li>
          <li><b>안전한 거래</b> — 승인된 기업만 참여하며, 현금은 이행 완료 전까지 에스크로로 보관됩니다.</li>
        </ul>
      </section>
      <section>
        <h2>문의</h2>
        <p>서비스 문의와 제안은 <b>{SITE.supportEmail}</b> 로 보내 주세요.</p>
      </section>
    </InfoShell>
  )
}

export function Privacy() {
  return (
    <InfoShell title="개인정보처리방침" lead={`${SITE.operator}(이하 "회사")는 「개인정보 보호법」 등 관련 법령을 준수하며, ${SITE.name} 서비스 이용자의 개인정보를 다음과 같이 처리합니다.`}>
      <p className="info-note">본 문서는 서비스 출시 전 초안입니다. 실제 시행 전 법률 검토를 거쳐 확정해 주세요.</p>
      <section>
        <h2>제1조 (수집하는 개인정보 항목)</h2>
        <ul>
          <li>필수: 담당자 이름, 이메일, 비밀번호(암호화 저장), 소속 기업명, 사업자등록번호, 대표자명</li>
          <li>선택: 담당자 연락처·직책, 기업 주소·전화번호·웹사이트, 사업 실적 등 기업 특성 정보</li>
          <li>자동 수집: 접속 기록, 서비스 이용 기록, 접속 IP, 브라우저 정보</li>
          <li>거래 시: 계약 서명자 정보, 결제·정산 기록</li>
        </ul>
      </section>
      <section>
        <h2>제2조 (개인정보의 처리 목적)</h2>
        <ul>
          <li>회원 가입 확인, 기업 진위 확인 및 관리자 승인</li>
          <li>교환 오퍼 추천, 협상 메신저, 계약서 작성, 결제·정산 등 거래 서비스 제공</li>
          <li>고객 문의 대응, 공지 전달, 부정 이용 방지</li>
        </ul>
      </section>
      <section>
        <h2>제3조 (보유 및 이용 기간)</h2>
        <p>회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령에 따라 다음 정보는 정해진 기간 동안 보관합니다.</p>
        <ul>
          <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
          <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
          <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
          <li>접속 기록: 3개월 (통신비밀보호법)</li>
        </ul>
      </section>
      <section>
        <h2>제4조 (제3자 제공)</h2>
        <p>회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 거래가 성립한 경우 계약 이행을 위해 거래 상대 기업에 기업명, 담당자 이름, 연락처를 제공하며, 법령에 따른 요청이 있는 경우는 예외로 합니다.</p>
      </section>
      <section>
        <h2>제5조 (처리 위탁)</h2>
        <p>회사는 결제 처리(전자지급결제대행사), 클라우드 인프라 운영 등 서비스 제공에 필요한 업무를 외부에 위탁할 수 있으며, 위탁 시 수탁자와 위탁 업무를 본 방침에 공개합니다.</p>
      </section>
      <section>
        <h2>제6조 (파기 절차 및 방법)</h2>
        <p>보유 기간이 끝난 개인정보는 지체 없이 파기합니다. 전자적 파일은 복구할 수 없는 방법으로 삭제하고, 종이 문서는 분쇄하거나 소각합니다.</p>
      </section>
      <section>
        <h2>제7조 (이용자의 권리)</h2>
        <p>이용자는 언제든지 자신의 개인정보를 열람·정정·삭제하거나 처리 정지를 요구할 수 있습니다. 요청은 기업 프로필 화면 또는 아래 연락처로 할 수 있습니다.</p>
      </section>
      <section>
        <h2>제8조 (안전성 확보 조치)</h2>
        <ul>
          <li>비밀번호 일방향 암호화(bcrypt) 저장, 전송 구간 암호화(HTTPS)</li>
          <li>접근 권한 관리 및 접속 기록 보관</li>
          <li>개인정보 취급자 최소화 및 교육</li>
        </ul>
      </section>
      <section>
        <h2>제9조 (개인정보 보호책임자)</h2>
        <p>{SITE.privacyOfficer} · 이메일 {SITE.supportEmail}</p>
      </section>
      <section>
        <h2>부칙</h2>
        <p>본 방침은 {SITE.effectiveDate}부터 시행합니다.</p>
      </section>
    </InfoShell>
  )
}

export function Terms() {
  return (
    <InfoShell title="이용약관" lead={`본 약관은 ${SITE.operator}(이하 "회사")가 운영하는 ${SITE.name} 서비스의 이용 조건과 절차, 회사와 회원의 권리·의무를 정합니다.`}>
      <p className="info-note">본 문서는 서비스 출시 전 초안입니다. 실제 시행 전 법률 검토를 거쳐 확정해 주세요.</p>
      <section>
        <h2>제1조 (목적)</h2>
        <p>본 약관은 회사가 제공하는 기업간 재화·용역 교환 중개 서비스(이하 "서비스")의 이용에 관한 사항을 정함을 목적으로 합니다.</p>
      </section>
      <section>
        <h2>제2조 (정의)</h2>
        <ul>
          <li>"회원"이란 사업자로서 회원가입 후 회사의 승인을 받은 기업과 그 담당자를 말합니다.</li>
          <li>"오퍼"란 회원이 제공할 재화·용역과 교환으로 희망하는 재화·용역 또는 현금을 게시한 것을 말합니다.</li>
          <li>"거래"란 협상을 통해 합의된 조건에 따라 회원 간에 체결되는 교환 계약을 말합니다.</li>
        </ul>
      </section>
      <section>
        <h2>제3조 (회원가입과 승인)</h2>
        <p>회원가입은 사업자등록번호 등 기업 정보를 제출하고 회사가 이를 확인해 승인함으로써 완료됩니다. 회사는 허위 정보 제출, 사업자 확인 불가 등의 경우 승인을 거절하거나 사후에 이용을 제한할 수 있습니다.</p>
      </section>
      <section>
        <h2>제4조 (서비스의 내용)</h2>
        <p>회사는 오퍼 등록·검색, AI 기반 추천, 협상 메신저, 계약서 작성, 에스크로 결제·정산 기능을 제공합니다. 회사는 거래의 중개자이며 거래 당사자가 아닙니다.</p>
      </section>
      <section>
        <h2>제5조 (거래와 정산)</h2>
        <ul>
          <li>거래는 양 당사자가 계약서에 전자서명함으로써 성립합니다.</li>
          <li>현금 지급이 포함된 거래의 대금은 회사가 지정한 에스크로로 보관되며, 양측의 이행 완료가 확인되면 지급됩니다.</li>
          <li>회사는 현금 정산액의 일정 비율을 수수료로 받을 수 있으며, 수수료율은 서비스 화면에 고지합니다.</li>
          <li>교환되는 재화·용역에 대한 세금계산서 발행 등 세무 의무는 각 당사자가 부담합니다.</li>
        </ul>
      </section>
      <section>
        <h2>제6조 (회원의 의무와 금지 행위)</h2>
        <ul>
          <li>사실과 다른 오퍼 게시, 타인의 정보 도용</li>
          <li>법령상 거래가 금지되거나 제한된 재화·용역의 게시</li>
          <li>플랫폼을 우회한 직거래 유도로 회사의 정산 절차를 회피하는 행위</li>
          <li>서비스 운영을 방해하거나 다른 회원에게 피해를 주는 행위</li>
        </ul>
      </section>
      <section>
        <h2>제7조 (책임의 제한)</h2>
        <p>회사는 회원 간 거래 대상의 품질·하자·이행에 대해 책임지지 않습니다. 다만 회사의 고의 또는 중대한 과실로 손해가 발생한 경우에는 관련 법령에 따라 책임을 집니다.</p>
      </section>
      <section>
        <h2>제8조 (분쟁 해결)</h2>
        <p>회원 간 분쟁은 당사자 간 협의로 해결하는 것을 원칙으로 하며, 회사는 요청 시 거래 기록을 제공해 원만한 해결을 지원합니다. 본 약관에 관한 소송은 회사의 본점 소재지 관할 법원으로 합니다.</p>
      </section>
      <section>
        <h2>부칙</h2>
        <p>본 약관은 {SITE.effectiveDate}부터 시행합니다. 문의: {SITE.supportEmail}</p>
      </section>
    </InfoShell>
  )
}
