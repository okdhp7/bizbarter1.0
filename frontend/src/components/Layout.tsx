import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ago, api } from '../api'
import { useAuth } from '../auth'
import type { Negotiation, Notification } from '../types'
import { Logo } from './Logo'
import Icon from './Icon'
import Footer from './Footer'

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [notes, setNotes] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const [unreadChats, setUnreadChats] = useState(0)
  const [menu, setMenu] = useState(false)
  const [toast, setToast] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const isAdmin = user?.role === 'admin'
  const isGuest = !user
  const member = !!user && !isAdmin

  useEffect(() => {
    if (!user) { setNotes([]); setUnreadChats(0); return }
    const load = () => {
      api<Notification[]>('/me/notifications').then(setNotes).catch(() => {})
      if (!isAdmin) api<Negotiation[]>('/negotiations').then(ns => setUnreadChats(ns.reduce((a, n) => a + n.unread, 0))).catch(() => {})
    }
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [user, isAdmin, loc.pathname])

  useEffect(() => { setOpen(false); setMenu(false) }, [loc.pathname])
  // 메뉴 바깥 클릭·ESC 로 닫기
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenu(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menu])
  // 로그아웃 등 화면 이동과 함께 전달된 알림 메시지
  useEffect(() => {
    const m = (loc.state as { toast?: string } | null)?.toast
    if (!m) return
    setToast(m)
    nav(loc.pathname + loc.search, { replace: true, state: null })
    const t = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(t)
  }, [loc.state])

  const doLogout = () => {
    setMenu(false)
    logout()
    nav(isAdmin ? '/admin' : '/', { replace: true, state: { toast: '로그아웃되었습니다' } })
  }
  const unread = notes.filter(n => !n.is_read).length

  const toggle = async () => {
    setOpen(o => !o)
    if (!open && unread) {
      await api('/me/notifications/read-all', { method: 'POST' })
      setTimeout(() => setNotes(ns => ns.map(n => ({ ...n, is_read: true }))), 2500)
    }
  }

  const initials = (user?.company?.name ?? '운영').replace(/^(\(주\)|㈜|주식회사)\s*/, '').slice(0, 2)
  const c = user?.company
  const filled = c ? [c.industry, c.products, c.needs, c.track_record, c.technologies.length, c.business_areas.length, c.certifications.length, c.interest_categories.length, c.address, c.description].filter(Boolean).length : 0
  const completeness = Math.round((filled / 10) * 100)

  return (
    <div className={`shell ${member ? 'has-tabbar' : ''}`}>
      <header className="topnav">
        <div className="topnav-inner">
          <Link to={isAdmin ? '/admin' : '/'} className="brand"><Logo /></Link>
          <nav className="topnav-links">
            {isAdmin ? (
              <NavLink to="/admin" className="nav-link"><Icon name="shield" size={16} />관리자</NavLink>
            ) : isGuest ? (
              <>
                <NavLink to="/" end className="nav-link"><Icon name="search" size={16} />오퍼 둘러보기</NavLink>
                <NavLink to="/about" className="nav-link"><Icon name="building" size={16} />서비스 소개</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/" end className="nav-link"><Icon name="search" size={16} />오퍼 탐색</NavLink>
                <NavLink to="/home" className="nav-link"><Icon name="home" size={16} />AI 추천</NavLink>
                <NavLink to="/offers/new" className="nav-link"><Icon name="plus" size={16} />오퍼 등록</NavLink>
                <NavLink to="/my/offers" className="nav-link"><Icon name="box" size={16} />내 오퍼</NavLink>
                <NavLink to="/negotiations" className="nav-link">
                  <Icon name="chat" size={16} />협상{unreadChats > 0 && <span className="count">{unreadChats}</span>}
                </NavLink>
                <NavLink to="/deals" className="nav-link"><Icon name="doc" size={16} />거래·계약</NavLink>
              </>
            )}
          </nav>
          <div className="topnav-right">
            {isGuest ? (
              <>
                <Link to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} className="btn btn-sm btn-ghost nav-login">로그인</Link>
                <Link to="/register" className="btn btn-sm btn-primary nav-join">기업 회원가입</Link>
              </>
            ) : (<>
            <div className="bell">
              <button className="icon-btn" onClick={toggle} aria-label="알림"><Icon name="bell" /></button>
              {unread > 0 && <span className="dot" />}
              {open && (
                <div className="pop card">
                  {notes.length === 0 && <div className="empty">알림이 없습니다</div>}
                  {notes.map(n => (
                    <Link key={n.id} to={n.link || '/'} className={n.is_read ? '' : 'unread'}>
                      <div style={{ fontWeight: 700 }}>{n.title}</div>
                      <div className="small muted">{n.body} · {ago(n.created_at)}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="user-menu" ref={menuRef}>
              <button className={`me-chip ${menu ? 'open' : ''}`} onClick={() => setMenu(m => !m)} aria-haspopup="menu" aria-expanded={menu}>
                <span className="me-avatar">{initials}</span>
                <span className="me-text"><b>{c?.name ?? '관리자'}</b><small>{isAdmin ? user?.email : `프로필 ${completeness}% 완성`}</small></span>
                <span className="me-caret"><Icon name="chevronDown" size={15} /></span>
              </button>
              {menu && (
                <div className="menu-pop card" role="menu">
                  <div className="menu-head">
                    <span className="me-avatar lg">{initials}</span>
                    <div><b>{user?.name}{user?.position ? ` · ${user.position}` : ''}</b><small>{user?.email}</small>{c && <small>{c.name}</small>}</div>
                  </div>
                  {!isAdmin && (
                    <>
                      <div className="menu-progress"><span>기업 프로필 완성도</span><b>{completeness}%</b><i><em style={{ width: `${completeness}%` }} /></i></div>
                      <Link to="/profile" role="menuitem"><Icon name="building" size={16} />기업 프로필 관리</Link>
                      <Link to="/my/offers" role="menuitem"><Icon name="box" size={16} />내 오퍼</Link>
                      <Link to="/deals" role="menuitem"><Icon name="doc" size={16} />거래·계약</Link>
                    </>
                  )}
                  {isAdmin && <Link to="/admin" role="menuitem"><Icon name="shield" size={16} />관리자 페이지</Link>}
                  <button className="menu-logout" role="menuitem" onClick={doLogout}><Icon name="logout" size={16} />로그아웃</button>
                </div>
              )}
            </div>
            </>)}
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
      {toast && <div className="toast" role="status"><Icon name="check" size={16} />{toast}</div>}
      <Footer />
      {member && (
        <nav className="tabbar" aria-label="하단 메뉴">
          <NavLink to="/" end className="tab"><Icon name="search" size={22} /><span>탐색</span></NavLink>
          <NavLink to="/home" className="tab"><Icon name="home" size={22} /><span>추천</span></NavLink>
          <NavLink to="/offers/new" className="tab tab-main"><span className="tab-plus"><Icon name="plus" size={22} /></span><span>등록</span></NavLink>
          <NavLink to="/negotiations" className="tab">
            <span className="tab-ico"><Icon name="chat" size={22} />{unreadChats > 0 && <i className="tab-badge">{unreadChats > 99 ? '99+' : unreadChats}</i>}</span><span>협상</span>
          </NavLink>
          <NavLink to="/deals" className="tab"><Icon name="doc" size={22} /><span>거래</span></NavLink>
        </nav>
      )}
    </div>
  )
}
