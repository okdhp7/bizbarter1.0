import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import CompanyForm, { emptyCompany } from '../components/CompanyForm'
import { AuthShell, PasswordInput, PwMeter } from '../components/AuthShell'
import Icon from '../components/Icon'

const STEPS = [
  { t: '담당자 계정', d: '로그인에 쓸 계정' },
  { t: '기업 정보', d: '사업자 확인용' },
  { t: 'AI 추천 정보', d: '선택 · 나중에 입력 가능' },
]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Register() {
  const nav = useNavigate()
  const { login } = useAuth()
  const [step, setStep] = useState(0)
  const [acct, setAcct] = useState({ email: '', password: '', password2: '', name: '', phone: '', position: '' })
  const [company, setCompany] = useState(emptyCompany)
  const [agree, setAgree] = useState({ terms: false, privacy: false })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => { document.title = '기업 회원가입 · BizBarter' }, [])
  useEffect(() => { top.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }, [step])
  // 입력을 고치면 오류 문구는 바로 지움
  useEffect(() => { setErr('') }, [acct, company, agree])

  const set = (k: keyof typeof acct) => (e: React.ChangeEvent<HTMLInputElement>) => setAcct({ ...acct, [k]: e.target.value })
  const pwMismatch = acct.password2.length > 0 && acct.password !== acct.password2
  const brnOk = company.biz_reg_no.replace(/\D/g, '').length === 10

  const check = (s: number): string => {
    if (s === 0) {
      if (!EMAIL_RE.test(acct.email.trim())) return '이메일 주소를 정확히 입력해 주세요.'
      if (!acct.name.trim()) return '담당자명을 입력해 주세요.'
      if (acct.password.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
      if (acct.password !== acct.password2) return '비밀번호 확인이 일치하지 않습니다.'
    }
    if (s === 1) {
      if (!company.name.trim()) return '기업명을 입력해 주세요.'
      if (!brnOk) return '사업자등록번호 10자리를 입력해 주세요.'
      if (!company.ceo_name.trim()) return '대표자명을 입력해 주세요.'
      if (!company.industry.trim()) return '주 사업분야를 입력해 주세요.'
    }
    if (s === 2 && !(agree.terms && agree.privacy)) return '필수 약관에 동의해 주세요.'
    return ''
  }

  const go = (to: number) => {
    if (to > step) {
      for (let s = step; s < to; s++) { const m = check(s); if (m) { setStep(s); setErr(m); return } }
    }
    setErr(''); setStep(to)
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (step < 2) return go(step + 1)
    for (let s = 0; s <= 2; s++) { const m = check(s); if (m) { setStep(s); setErr(m); return } }
    setErr(''); setBusy(true)
    try {
      const { password2, ...rest } = acct
      await api('/auth/register', { body: { ...rest, email: acct.email.trim(), company } })
      await login(acct.email.trim(), acct.password)
      nav('/pending', { replace: true })
    } catch (e: any) {
      const m: string = e.message || '가입 신청에 실패했습니다.'
      setErr(m)
      if (/이메일/.test(m)) setStep(0)
    } finally { setBusy(false) }
  }

  const allAgree = agree.terms && agree.privacy

  return (
    <AuthShell right={<Link to="/login" className="btn btn-sm hide-mobile">로그인</Link>}>
      <div className="reg-wrap" ref={top}>
        <div className="reg-head">
          <h1>기업 회원가입</h1>
          <p className="muted">3단계, 약 2분이면 끝납니다. 가입 신청 후 관리자 승인을 거쳐 이용할 수 있습니다.</p>
        </div>

        <ol className="stepper" aria-label="가입 단계">
          {STEPS.map((s, i) => (
            <li key={s.t} className={i === step ? 'on' : i < step ? 'done' : ''}>
              <button type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined}>
                <span className="dot">{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
                <span className="lbl"><b>{s.t}</b><small>{s.d}</small></span>
              </button>
            </li>
          ))}
        </ol>

        <form className="reg-card stack" onSubmit={submit} noValidate>
          {err && <div className="error" role="alert"><Icon name="alert" size={15} />{err}</div>}

          {step === 0 && (
            <div className="stack">
              <div className="grid-2">
                <div className="field"><label>이메일 *</label><input className="input" type="email" autoComplete="email" placeholder="name@company.com" value={acct.email} onChange={set('email')} autoFocus /></div>
                <div className="field"><label>담당자명 *</label><input className="input" autoComplete="name" value={acct.name} onChange={set('name')} /></div>
                <div className="field">
                  <label>비밀번호 * <span className="hint">8자 이상, 영문·숫자 조합 권장</span></label>
                  <PasswordInput autoComplete="new-password" value={acct.password} onChange={v => setAcct({ ...acct, password: v })} />
                  <PwMeter value={acct.password} />
                </div>
                <div className="field">
                  <label>비밀번호 확인 *</label>
                  <PasswordInput autoComplete="new-password" value={acct.password2} onChange={v => setAcct({ ...acct, password2: v })} />
                  {acct.password2 && (pwMismatch
                    ? <div className="field-hint bad"><Icon name="alert" size={13} />비밀번호가 일치하지 않습니다</div>
                    : <div className="field-hint ok"><Icon name="check" size={13} />일치합니다</div>)}
                </div>
                <div className="field"><label>연락처</label><input className="input" type="tel" autoComplete="tel" placeholder="010-0000-0000" value={acct.phone} onChange={set('phone')} /></div>
                <div className="field"><label>직책</label><input className="input" placeholder="예: 구매팀 과장" value={acct.position} onChange={set('position')} /></div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="stack">
              <CompanyForm value={company} onChange={setCompany} section="basic" />
              <p className="small muted">이미 등록된 사업자등록번호면 해당 기업의 추가 담당자로 신청됩니다.</p>
            </div>
          )}

          {step === 2 && (
            <div className="stack">
              <div className="note-ai"><Icon name="chat" size={16} /><span>아래 정보를 채울수록 <b>AI 추천 정확도</b>가 높아집니다. 지금 건너뛰고 가입 후 ‘기업 프로필’에서 입력해도 됩니다.</span></div>
              <CompanyForm value={company} onChange={setCompany} section="traits" />
              <div className="agree-box">
                <label className="check strong">
                  <input type="checkbox" checked={allAgree} onChange={e => setAgree({ terms: e.target.checked, privacy: e.target.checked })} />
                  전체 동의
                </label>
                <label className="check"><input type="checkbox" checked={agree.terms} onChange={e => setAgree({ ...agree, terms: e.target.checked })} />
                  <span>[필수] <Link to="/terms" target="_blank" className="text-link">이용약관</Link> 동의</span></label>
                <label className="check"><input type="checkbox" checked={agree.privacy} onChange={e => setAgree({ ...agree, privacy: e.target.checked })} />
                  <span>[필수] <Link to="/privacy" target="_blank" className="text-link">개인정보 수집·이용</Link> 동의</span></label>
              </div>
            </div>
          )}

          <div className="reg-actions">
            {step > 0 ? <button type="button" className="btn btn-lg" onClick={() => go(step - 1)}><Icon name="back" size={16} />이전</button> : <Link to="/login" className="btn btn-lg btn-ghost">취소</Link>}
            <span className="spacer" />
            {step < 2
              ? <button className="btn btn-primary btn-lg">다음 단계</button>
              : <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? '신청 중…' : '가입 신청 완료'}</button>}
          </div>
        </form>
        <p className="small muted" style={{ textAlign: 'center', marginTop: 16 }}>이미 회원이신가요? <Link to="/login" className="text-link">로그인</Link></p>
      </div>
    </AuthShell>
  )
}
