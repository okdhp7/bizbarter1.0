import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { LogoWatermark } from '../components/Logo'
import { AuthShell, PasswordInput } from '../components/AuthShell'
import Icon from '../components/Icon'

const REMEMBER_KEY = 'bb_saved_email'
const readSaved = () => { try { return localStorage.getItem(REMEMBER_KEY) ?? '' } catch { return '' } }
const writeSaved = (v: string | null) => { try { v ? localStorage.setItem(REMEMBER_KEY, v) : localStorage.removeItem(REMEMBER_KEY) } catch { /* 저장 불가 환경 */ } }

/** 로그인 후 돌아갈 주소 (외부 주소·로그인 화면 자체는 제외) */
export const safeNext = (search: string) => {
  const next = new URLSearchParams(search).get('next')
  return next && next.startsWith('/') && !next.startsWith('//') && !/^\/(login|register|pending)/.test(next) ? next : '/'
}

export function AuthHero() {
  return (
    <div className="auth-hero">
      <div style={{ position: 'relative' }}>
        <span className="hero-eyebrow">AI B2B Exchange</span>
        <h1>남는 자원이<br />다른 기업의 필요가 되는 곳</h1>
        <p className="lead">
          재고, 유휴 설비, 전문 용역을 다른 기업의 재화·서비스 또는 현금과 교환합니다.
          기업 프로필을 분석해 서로에게 필요한 상대를 먼저 연결해 드립니다.
        </p>
      </div>
      <div className="facts">
        <div><b>승인 기업 전용</b>사업자 확인 후 참여</div>
        <div><b>전자 계약</b>합의 즉시 계약서 생성</div>
        <div><b>에스크로 정산</b>이행 완료 후 지급</div>
      </div>
      <LogoWatermark className="hero-mark" />
    </div>
  )
}

export default function Login() {
  const { user, login, logout } = useAuth()
  const nav = useNavigate()
  const saved = readSaved()
  const [email, setEmail] = useState(saved)
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(!!saved)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const next = safeNext(location.search)

  useEffect(() => { document.title = '로그인 · BizBarter' }, [])

  // 이미 로그인한 상태로 들어오면 바로 이동
  if (user && !busy) return <Navigate to={user.role === 'admin' ? '/admin' : user.status === 'approved' ? next : '/pending'} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const u = await login(email.trim(), password)
      if (u.role === 'admin') {
        logout()
        setErr('관리자 계정은 관리자 페이지(/admin)에서 로그인하세요.')
        return
      }
      writeSaved(remember ? email.trim() : null)
      nav(u.status === 'approved' ? next : '/pending', { replace: true })
    } catch (e: any) {
      setErr(e.message || '로그인에 실패했습니다.')
      setPassword('')
    } finally { setBusy(false) }
  }

  return (
    <AuthShell right={<Link to={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="btn btn-sm hide-mobile">기업 회원가입</Link>}>
      <div className="auth">
        <AuthHero />
        <div className="auth-form">
          <form className="auth-card stack" onSubmit={submit} noValidate={false}>
            <div>
              <h1>로그인</h1>
              <p className="muted" style={{ marginTop: 6 }}>
                {next !== '/' ? '로그인하면 보던 화면으로 바로 돌아갑니다.' : '승인된 기업 회원 계정으로 로그인하세요.'}
              </p>
            </div>
            {err && <div className="error" role="alert"><Icon name="alert" size={15} />{err}</div>}
            <div className="field">
              <label htmlFor="login-email">이메일</label>
              <input id="login-email" className="input" type="email" autoComplete="username" placeholder="name@company.com"
                value={email} onChange={e => setEmail(e.target.value)} required autoFocus={!saved} />
            </div>
            <div className="field">
              <label htmlFor="login-pw">비밀번호</label>
              <PasswordInput id="login-pw" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={setPassword} required autoFocus={!!saved} />
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <label className="check"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />이메일 저장</label>
              <span className="small muted" title="비밀번호 재설정은 하단 ‘고객의 소리’ 이메일로 문의해 주세요">비밀번호 분실 시 고객의 소리로 문의</span>
            </div>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy || !email || !password}>{busy ? '로그인 중…' : '로그인'}</button>
            <div className="auth-divider"><span>BizBarter 가 처음이신가요?</span></div>
            <Link to={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="btn btn-lg btn-block">기업 회원가입</Link>
            <p className="small muted" style={{ textAlign: 'center' }}>가입 신청 후 관리자 승인이 끝나면 협상·거래 기능을 이용할 수 있습니다.</p>
          </form>
        </div>
      </div>
    </AuthShell>
  )
}
