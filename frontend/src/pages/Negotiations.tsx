import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ago, api, dt, won, wsUrl } from '../api'
import { useAuth } from '../auth'
import type { Message, Negotiation, Proposal } from '../types'
import { wantLabel } from '../components/ui'
import Icon from '../components/Icon'

const NEG_STATUS: Record<string, [string, string]> = { active: ['협상중', 'amber'], agreed: ['합의완료', 'teal'], closed: ['종료', ''] }

export default function Negotiations() {
  const { id } = useParams()
  const [list, setList] = useState<Negotiation[]>([])
  const [tab, setTab] = useState<'all' | 'owner' | 'buyer'>('all')
  const load = useCallback(() => api<Negotiation[]>('/negotiations').then(setList), [])
  useEffect(() => { load() }, [load, id])
  const shown = list.filter(n => tab === 'all' || n.my_side === tab)

  return (
    <>
      <div className={`page-head ${id ? 'hide-mobile' : ''}`}><div><h1>협상 메신저</h1><p>오퍼별 1:1 대화로 교환 조건을 협상하고, 거래조건을 제안·수락하세요.</p></div></div>
      <div className={`msgr ${id ? 'has-room' : ''}`}>
        <div className="card">
          <div className="conv-head chips">
            {([['all', '전체'], ['owner', '받은 요청'], ['buyer', '보낸 요청']] as const).map(([v, l]) => (
              <button key={v} className={`chip ${tab === v ? 'on' : ''}`} onClick={() => setTab(v)}>{l}</button>
            ))}
          </div>
          <div className="conv-list">
            {shown.length === 0 && <div className="empty">협상 내역이 없습니다.<br /><Link to="/" style={{ color: 'var(--teal)' }}>오퍼 둘러보기</Link></div>}
            {shown.map(n => {
              const other = n.my_side === 'owner' ? n.buyer_company : n.owner_company
              const [l, c] = NEG_STATUS[n.status]
              return (
                <Link key={n.id} to={`/negotiations/${n.id}`} className={`conv ${String(n.id) === id ? 'active' : ''}`}>
                  <div className="row"><span className="t">{other.name}</span><span className={`badge ${c}`}>{l}</span>
                    <span className="spacer" />{n.unread > 0 && <span className="badge amber">{n.unread}</span>}</div>
                  <div className="small clamp" style={{ fontWeight: 600 }}>{n.offer.title}</div>
                  <div className="small muted row"><span className="clamp spacer">{n.last_message}</span><span>{ago(n.last_message_at)}</span></div>
                </Link>
              )
            })}
          </div>
        </div>
        {id ? <Room key={id} id={Number(id)} onChange={load} /> : <div className="card empty msgr-placeholder" style={{ display: 'grid', placeItems: 'center' }}>왼쪽에서 협상을 선택하세요</div>}
      </div>
    </>
  )
}

function Room({ id, onChange }: { id: number; onChange: () => void }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [n, setN] = useState<Negotiation | null>(null)
  const [msgs, setMsgs] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [showProp, setShowProp] = useState(false)
  const [typing, setTyping] = useState(false)
  const [err, setErr] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const ws = useRef<WebSocket | null>(null)
  const lastTyping = useRef(0)

  const reload = useCallback(async () => {
    const [neg, ms] = await Promise.all([api<Negotiation>(`/negotiations/${id}`), api<Message[]>(`/negotiations/${id}/messages`)])
    setN(neg); setMsgs(ms)
  }, [id])

  useEffect(() => {
    reload().catch(e => setErr(e.message))
    let alive = true
    let retry: ReturnType<typeof setTimeout>
    const connect = () => {
      const sock = new WebSocket(wsUrl(`/ws/negotiations/${id}`))
      ws.current = sock
      sock.onmessage = ev => {
        const data = JSON.parse(ev.data)
        if (data.event === 'typing') {
          if (data.company_id !== user?.company_id) { setTyping(true); setTimeout(() => setTyping(false), 2500) }
          return
        }
        const m: Message = data.message
        setMsgs(prev => {
          const i = prev.findIndex(x => x.id === m.id)
          if (i >= 0) { const c = [...prev]; c[i] = m; return c }
          return [...prev, m]
        })
        if (m.kind !== 'text') api<Negotiation>(`/negotiations/${id}`).then(setN)
      }
      sock.onclose = () => { if (alive) retry = setTimeout(connect, 3000) }
    }
    connect()
    return () => { alive = false; clearTimeout(retry); ws.current?.close() }
  }, [id, reload, user?.company_id])

  useEffect(() => { scroller.current?.scrollTo({ top: 1e9 }) }, [msgs.length, typing])

  const upsert = (m: Message) => setMsgs(prev => prev.some(x => x.id === m.id) ? prev.map(x => x.id === m.id ? m : x) : [...prev, m])

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    const content = text; setText('')
    try { upsert(await api<Message>(`/negotiations/${id}/messages`, { body: { content } })); onChange() } catch (e: any) { setErr(e.message) }
  }
  const onType = (v: string) => {
    setText(v)
    if (Date.now() - lastTyping.current > 2000 && ws.current?.readyState === 1) {
      ws.current.send(JSON.stringify({ event: 'typing' })); lastTyping.current = Date.now()
    }
  }
  const respond = async (mid: number, action: string) => {
    setErr('')
    try {
      const r = await api<{ message: Message; deal_id: number | null }>(`/negotiations/${id}/proposals/${mid}/${action}`, { method: 'POST' })
      upsert(r.message); await reload(); onChange()
      if (r.deal_id) nav(`/deals/${r.deal_id}`)
    } catch (e: any) { setErr(e.message) }
  }
  const close = async () => { if (confirmClose()) { await api(`/negotiations/${id}/close`, { method: 'POST' }); reload(); onChange() } }

  if (!n) return <div className="card empty">{err || '불러오는 중…'}</div>
  const other = n.my_side === 'owner' ? n.buyer_company : n.owner_company
  const sideName = (s?: string) => (s === 'owner' ? n.owner_company.name : n.buyer_company.name)

  return (
    <div className="card chat-wrap room">
      <div className="conv-head room-head">
        <Link to="/negotiations" className="icon-btn only-mobile" aria-label="협상 목록으로"><Icon name="back" /></Link>
        <div className="spacer" style={{ minWidth: 0 }}>
          <div className="row"><h3>{other.name}</h3><span className="small muted">{other.industry}</span></div>
          <Link to={`/offers/${n.offer.id}`} className="small" style={{ color: 'var(--teal)' }}>#{n.offer.id} {n.offer.title} · {won(n.offer.estimated_value)} ⇄ {wantLabel(n.offer)}</Link>
        </div>
        {n.deal_id && <Link to={`/deals/${n.deal_id}`} className="btn btn-sm btn-teal">거래 보기</Link>}
        {n.status === 'active' && <>
          <button className="btn btn-sm btn-accent" onClick={() => setShowProp(s => !s)}>거래조건 제안</button>
          <button className="btn btn-sm btn-ghost btn-danger" onClick={close}>협상 종료</button>
        </>}
      </div>
      {err && <div className="error" style={{ margin: 10 }}>{err}</div>}
      {showProp && <ProposalForm n={n} onDone={m => { upsert(m); setShowProp(false); onChange() }} onCancel={() => setShowProp(false)} />}
      <div className="chat-scroll" ref={scroller}>
        {msgs.map(m => {
          if (m.kind === 'system') return (
            <div key={m.id} className="bubble sys">
              {m.content} · {dt(m.created_at, true)}
              {m.proposal?.deal_id && <> <Link to={`/deals/${m.proposal.deal_id}`} style={{ color: 'var(--teal)', fontWeight: 600 }}>계약서 보기 →</Link></>}
            </div>
          )
          if (m.kind === 'proposal' && m.proposal) return <ProposalCard key={m.id} m={m} p={m.proposal} mine={m.sender_company_id === user?.company_id}
            fromName={sideName(m.proposal.proposer_side)} n={n} onAct={a => respond(m.id, a)} />
          const mine = m.sender_company_id === user?.company_id
          return (
            <div key={m.id} className={`msg-row ${mine ? 'me' : ''}`}>
              <div className="bubble-meta">{mine ? '' : `${m.sender_name} · `}{dt(m.created_at, true)}</div>
              <div className={`bubble ${mine ? 'me' : 'bot'}`}>{m.content}</div>
            </div>
          )
        })}
        {typing && <div className="small muted">{other.name}에서 입력 중…</div>}
      </div>
      {n.status !== 'closed' ? (
        <form className="composer" onSubmit={send}>
          <input className="input" placeholder="메시지를 입력하세요" value={text} onChange={e => onType(e.target.value)} />
          <button className="btn btn-primary" disabled={!text.trim()}>전송</button>
        </form>
      ) : <div className="composer muted">종료된 협상입니다.</div>}
    </div>
  )
}

const confirmClose = () => window.confirm('협상을 종료할까요? 종료 후에는 메시지를 보낼 수 없습니다.')

function ProposalCard({ m, p, mine, fromName, n, onAct }: { m: Message; p: Proposal; mine: boolean; fromName: string; n: Negotiation; onAct: (a: string) => void }) {
  const STATE: Record<string, [string, string]> = {
    pending: ['응답 대기', 'amber'], accepted: ['수락됨', 'teal'], rejected: ['거절됨', 'red'], withdrawn: ['철회됨', ''], superseded: ['새 제안으로 대체', ''],
  }
  const [l, c] = STATE[p.state ?? 'pending']
  const payer = p.cash_payer === 'owner' ? n.owner_company.name : p.cash_payer === 'buyer' ? n.buyer_company.name : null
  return (
    <div className={`proposal-card ${p.state !== 'pending' ? 'done' : ''}`}>
      <div className="row" style={{ marginBottom: 10 }}>
        <b>거래조건 제안</b><span className="small muted">from {fromName}</span><span className="spacer" /><span className={`badge ${c}`}>{l}</span>
      </div>
      <div className="swap">
        <div><span className="lbl">{n.owner_company.name} 제공</span>{p.owner_gives}</div>
        <div className="arrow">⇄</div>
        <div><span className="lbl">{n.buyer_company.name} 제공</span>{p.buyer_gives}</div>
      </div>
      <dl className="kv small" style={{ marginTop: 10, gridTemplateColumns: '80px 1fr' }}>
        <dt>차액 정산</dt><dd>{payer ? `${payer} → ${p.cash_amount.toLocaleString()}원` : '없음 (순수 교환)'}</dd>
        <dt>이행 기한</dt><dd>{p.delivery_date || '계약 후 30일'}</dd>
        {p.notes && <><dt>특약</dt><dd>{p.notes}</dd></>}
      </dl>
      {p.state === 'pending' && (
        <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
          {mine ? <button className="btn btn-sm" onClick={() => onAct('withdraw')}>제안 철회</button> : <>
            <button className="btn btn-sm btn-danger" onClick={() => onAct('reject')}>거절</button>
            <button className="btn btn-sm btn-teal" onClick={() => onAct('accept')}>수락하고 계약 진행</button>
          </>}
        </div>
      )}
      <div className="small muted" style={{ textAlign: 'right', marginTop: 6 }}>{dt(m.created_at, true)}</div>
    </div>
  )
}

function ProposalForm({ n, onDone, onCancel }: { n: Negotiation; onDone: (m: Message) => void; onCancel: () => void }) {
  // 현금을 희망하는 오퍼는 협상 요청 기업이 현금을 지급하는 조건으로 미리 채움
  const cashOnly = n.offer.want_cash && (!n.offer.wants || n.offer.wants === '현금')
  const [p, setP] = useState({
    owner_gives: n.offer.title + (n.offer.quantity ? ` (${n.offer.quantity})` : ''),
    buyer_gives: cashOnly ? '현금 결제' : (n.offer.want_cash ? n.offer.wants : ''),
    cash_amount: n.offer.want_cash && n.offer.want_cash_amount ? String(n.offer.want_cash_amount) : '',
    cash_payer: n.offer.want_cash ? 'buyer' : 'none', delivery_date: '', notes: '',
  })
  const [err, setErr] = useState('')
  const set = (k: keyof typeof p) => (e: React.ChangeEvent<any>) => setP({ ...p, [k]: e.target.value })
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('')
    try {
      onDone(await api<Message>(`/negotiations/${n.id}/proposals`, { body: { ...p, cash_amount: Number(String(p.cash_amount).replace(/\D/g, '') || 0) } }))
    } catch (e: any) { setErr(e.message) }
  }
  return (
    <form onSubmit={submit} className="stack" style={{ padding: 16, borderBottom: '1px solid var(--line)', background: '#fffaf1' }}>
      {err && <div className="error">{err}</div>}
      <div className="grid-2">
        <div className="field"><label>{n.owner_company.name} 제공 (오퍼 등록 기업)</label><textarea className="textarea" style={{ minHeight: 60 }} value={p.owner_gives} onChange={set('owner_gives')} required /></div>
        <div className="field"><label>{n.buyer_company.name} 제공 (협상 요청 기업)</label><textarea className="textarea" style={{ minHeight: 60 }} value={p.buyer_gives} onChange={set('buyer_gives')} required /></div>
      </div>
      <div className="grid-3">
        <div className="field"><label>{n.offer.want_cash ? '현금 지급' : '차액 지급'}</label>
          <select className="select" value={p.cash_payer} onChange={set('cash_payer')} disabled={!n.offer.allow_cash}>
            <option value="none">없음</option><option value="owner">{n.owner_company.name} 지급</option><option value="buyer">{n.buyer_company.name} 지급</option>
          </select>
          {!n.offer.allow_cash && <span className="hint">이 오퍼는 순수 물물교환만 허용</span>}
        </div>
        <div className="field"><label>{n.offer.want_cash ? '현금 금액(원)' : '차액(원)'}</label><input className="input" inputMode="numeric" value={p.cash_amount} onChange={set('cash_amount')} disabled={p.cash_payer === 'none'} /></div>
        <div className="field"><label>이행 기한</label><input className="input" type="date" value={p.delivery_date} onChange={set('delivery_date')} /></div>
      </div>
      <div className="field"><label>특약사항</label><input className="input" value={p.notes} onChange={set('notes')} /></div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-sm" onClick={onCancel}>취소</button><button className="btn btn-sm btn-accent">제안 보내기</button></div>
    </form>
  )
}
