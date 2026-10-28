import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { Logo } from '../components/Logo'
import Icon from '../components/Icon'

/** 관리자 전용 로그인 — localhost:3500/admin */
export default function AdminLogin() {
  const { login, logout } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      const u = await login(email, password)
      if (u.role !== 'admin') {
        logout()
        setErr('관리자 계정이 아닙니다. 기업 회원은 일반 로그인 화면을 이용하세요.')
      }
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="admin-login">
      <form className="card card-pad auth-box stack" onSubmit={submit}>
        <div className="row"><Logo /><span className="spacer" /><span className="badge indigo"><Icon name="shield" size={13} />&nbsp;ADMIN</span></div>
        <div>
          <h1>관리자 로그인</h1>
          <p className="muted" style={{ marginTop: 8 }}>회원 가입 승인과 서비스 운영을 위한 관리자 전용 화면입니다.</p>
        </div>
        {err && <div className="error">{err}</div>}
        <div className="field"><label>관리자 이메일</label><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></div>
        <div className="field"><label>비밀번호</label><input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? '로그인 중…' : '관리자 로그인'}</button>
      </form>
    </div>
  )
}
