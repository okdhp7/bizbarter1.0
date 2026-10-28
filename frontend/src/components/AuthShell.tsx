import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import Icon from './Icon'
import Footer from './Footer'

/** 로그인·회원가입 공통 틀 — 얇은 상단 바(로고/오퍼 둘러보기) + 본문 + 푸터 */
export function AuthShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="auth-page">
      <header className="auth-bar">
        <Link to="/" className="brand" aria-label="BizBarter 홈"><Logo /></Link>
        <div className="auth-bar-right">
          {right}
          <Link to="/" className="btn btn-sm btn-ghost"><Icon name="search" size={15} />오퍼 둘러보기</Link>
        </div>
      </header>
      <div className="auth-body">{children}</div>
      <Footer />
    </div>
  )
}

/** 비밀번호 입력 — 보기/숨기기, Caps Lock 경고 */
export function PasswordInput({ value, onChange, ...rest }: { value: string; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const key = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.('CapsLock') ?? false)
  return (
    <>
      <div className="input-wrap">
        <input {...rest} className="input" type={show ? 'text' : 'password'} value={value}
          onChange={e => onChange(e.target.value)} onKeyUp={key} onKeyDown={key} onBlur={() => setCaps(false)} />
        <button type="button" className="input-icon" onClick={() => setShow(s => !s)}
          aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'} title={show ? '숨기기' : '보기'}>
          <Icon name={show ? 'eyeOff' : 'eye'} size={17} />
        </button>
      </div>
      {caps && <div className="field-hint warn"><Icon name="alert" size={13} />Caps Lock 이 켜져 있습니다</div>}
    </>
  )
}

/** 비밀번호 강도 (0~4) */
export function pwStrength(p: string) {
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[A-Za-z]/.test(p) && /\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p)) s++
  return Math.min(s, 4)
}

export function PwMeter({ value }: { value: string }) {
  if (!value) return null
  const s = pwStrength(value)
  const label = value.length < 8 ? '8자 이상 입력하세요' : ['약함', '약함', '보통', '좋음', '강함'][s]
  return (
    <div className={`pw-meter s${value.length < 8 ? 0 : s}`}>
      <span><i /><i /><i /><i /></span><em>{label}</em>
    </div>
  )
}
