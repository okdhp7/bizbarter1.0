import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SITE } from '../siteConfig'
import { LogoMark } from './Logo'

/** http(사내 IP 접속)에서도 동작하도록 클립보드 API 실패 시 대체 방식 사용 */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  }
}

function VoiceOfCustomer() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    const ok = await copyText(SITE.supportEmail)
    setOpen(true)
    setCopied(ok)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { setCopied(false); setOpen(false) }, 1800)
  }

  return (
    <span className="voc" onMouseEnter={() => setOpen(true)} onMouseLeave={() => !copied && setOpen(false)}>
      <button type="button" className="footer-link voc-btn" onClick={copy} onFocus={() => setOpen(true)} onBlur={() => !copied && setOpen(false)}
        aria-describedby="voc-tip">고객의 소리</button>
      <span id="voc-tip" role="tooltip" className={`voc-tip ${open ? 'show' : ''} ${copied ? 'copied' : ''}`}>
        {copied ? <>복사되었습니다</> : <><b>{SITE.supportEmail}</b><small>클릭하면 이메일 주소가 복사됩니다</small></>}
      </span>
    </span>
  )
}

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand"><LogoMark size={22} /><span>{SITE.name}</span></div>
        <nav className="footer-links" aria-label="사이트 정보">
          <Link to="/about" className="footer-link">서비스 소개</Link>
          <Link to="/privacy" className="footer-link strong">개인정보처리방침</Link>
          <Link to="/terms" className="footer-link">이용약관</Link>
          <VoiceOfCustomer />
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} {SITE.operator}. All rights reserved.</p>
      </div>
    </footer>
  )
}
