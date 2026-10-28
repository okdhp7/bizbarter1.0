import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, dt, won } from '../api'
import { Badge } from '../components/ui'
import type { Offer, User } from '../types'

interface Stats { users_pending: number; users_approved: number; companies: number; offers_open: number; negotiations_active: number; deals_total: number; deals_completed: number; trade_volume: number }

export default function Admin() {
  const [tab, setTab] = useState<'pending' | 'users' | 'offers'>('pending')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [offers, setOffers] = useState<Offer[]>([])
  const [open, setOpen] = useState<number | null>(null)

  const load = () => {
    api<Stats>('/admin/stats').then(setStats)
    if (tab === 'offers') api<Offer[]>('/admin/offers').then(setOffers)
    else api<User[]>(`/admin/users${tab === 'pending' ? '?status=pending' : ''}`).then(setUsers)
  }
  useEffect(load, [tab])

  const decide = async (u: User, approve: boolean) => {
    let reason = ''
    if (!approve) { reason = window.prompt('반려 사유를 입력하세요', '사업자 정보 확인 불가') ?? ''; if (!reason) return }
    await api(`/admin/users/${u.id}/approval`, { body: { approve, reason } })
    load()
  }

  return (
    <>
      <div className="page-head"><div><h1>관리자</h1><p>회원 가입 승인, 회원·오퍼 관리</p></div></div>
      {stats && (
        <div className="stats">
          <div className="card stat"><div className="k">승인 대기</div><div className="v" style={{ color: 'var(--accent)' }}>{stats.users_pending}</div></div>
          <div className="card stat"><div className="k">승인 회원 / 기업</div><div className="v">{stats.users_approved} / {stats.companies}</div></div>
          <div className="card stat"><div className="k">게시 오퍼 / 협상</div><div className="v">{stats.offers_open} / {stats.negotiations_active}</div></div>
          <div className="card stat"><div className="k">거래 (완료) · 정산액</div><div className="v">{stats.deals_total} ({stats.deals_completed})</div><div className="small muted">{won(stats.trade_volume)}</div></div>
        </div>
      )}
      <div className="chips" style={{ marginBottom: 14 }}>
        <button className={`chip ${tab === 'pending' ? 'on' : ''}`} onClick={() => setTab('pending')}>가입 승인 대기</button>
        <button className={`chip ${tab === 'users' ? 'on' : ''}`} onClick={() => setTab('users')}>전체 회원</button>
        <button className={`chip ${tab === 'offers' ? 'on' : ''}`} onClick={() => setTab('offers')}>오퍼 관리</button>
      </div>
      <div className="card table-scroll">
        {tab !== 'offers' ? (
          users.length === 0 ? <div className="empty">{tab === 'pending' ? '승인 대기 중인 회원이 없습니다.' : '회원이 없습니다.'}</div> : (
            <table className="table">
              <thead><tr><th>기업</th><th>담당자</th><th>사업자번호</th><th>주 사업분야</th><th>신청일</th><th>상태</th><th></th></tr></thead>
              <tbody>{users.map(u => (<Fragment key={u.id}>
                <tr>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === u.id ? null : u.id)}>{open === u.id ? '▾' : '▸'} <b>{u.company?.name}</b></button></td>
                  <td>{u.name}<div className="small muted">{u.email} · {u.phone}</div></td>
                  <td>{u.company?.biz_reg_no}</td>
                  <td>{u.company?.industry}</td>
                  <td className="small muted">{dt(u.created_at)}</td>
                  <td><Badge kind="user" value={u.status} /></td>
                  <td className="row">
                    {u.status !== 'approved' && <button className="btn btn-sm btn-teal" onClick={() => decide(u, true)}>승인</button>}
                    {u.status === 'pending' && <button className="btn btn-sm btn-danger" onClick={() => decide(u, false)}>반려</button>}
                    {(u.status === 'approved' || u.status === 'suspended') && <button className="btn btn-sm" onClick={() => api(`/admin/users/${u.id}/suspend`, { method: 'POST' }).then(load)}>{u.status === 'suspended' ? '정지 해제' : '정지'}</button>}
                  </td>
                </tr>
                {open === u.id && u.company && (
                  <tr><td colSpan={7} style={{ background: '#fbfaf7' }}>
                    <dl className="kv">
                      <dt>대표자</dt><dd>{u.company.ceo_name}</dd><dt>주소</dt><dd>{u.company.address || '-'}</dd>
                      <dt>보유기술</dt><dd>{u.company.technologies.join(', ') || '-'}</dd><dt>사업 실적</dt><dd>{u.company.track_record || '-'}</dd>
                      <dt>제공 가능</dt><dd>{u.company.products || '-'}</dd><dt>필요</dt><dd>{u.company.needs || '-'}</dd>
                    </dl>
                  </td></tr>
                )}
              </Fragment>))}</tbody>
            </table>
          )
        ) : (
          <table className="table">
            <thead><tr><th>#</th><th>오퍼</th><th>기업</th><th>카테고리</th><th>상태</th><th>등록일</th><th></th></tr></thead>
            <tbody>{offers.map(o => (
              <tr key={o.id}>
                <td>{o.id}</td><td><Link to={`/offers/${o.id}`}>{o.title}</Link></td><td>{o.company.name}</td><td>{o.category}</td>
                <td><Badge kind="offer" value={o.status} /></td><td className="small muted">{dt(o.created_at)}</td>
                <td>{o.status !== 'cancelled' && <button className="btn btn-sm btn-danger" onClick={() => window.confirm('이 오퍼를 비공개 처리할까요?') && api(`/admin/offers/${o.id}/hide`, { method: 'POST' }).then(load)}>비공개</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  )
}
