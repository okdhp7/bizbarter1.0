import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, won } from '../api'
import { LogoMark } from '../components/Logo'
import { wantLabel } from '../components/ui'
import type { Draft } from '../types'
import { CategoryChip, CategoryPicker, describe, useMeta } from '../components/Category'

/** 채팅형 Q&A 오퍼 등록 도우미 */
export default function OfferNew() {
  const [mode, setMode] = useState<'chat' | 'form'>('chat')
  return (
    <>
      <div className="page-head">
        <div><h1>교환 오퍼 등록</h1><p>질문에 답하면 AI 도우미가 오퍼를 완성해 드립니다. 익숙하시면 직접 입력도 가능합니다.</p></div>
        <div className="row">
          <button className={`chip ${mode === 'chat' ? 'on' : ''}`} onClick={() => setMode('chat')}>대화형 등록</button>
          <button className={`chip ${mode === 'form' ? 'on' : ''}`} onClick={() => setMode('form')}>직접 입력</button>
        </div>
      </div>
      {mode === 'chat' ? <ChatWizard /> : <OfferForm />}
    </>
  )
}

function ChatWizard() {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    api<Draft>('/assistant/drafts', { method: 'POST' }).then(setDraft)
  }, [])
  useEffect(() => { scroller.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [draft?.messages.length, busy])

  const send = async (answer: string) => {
    if (!draft || !answer.trim() || busy) return
    setBusy(true)
    setDraft({ ...draft, messages: [...draft.messages, { role: 'user', content: answer, choices: [] }] })
    setText('')
    try { setDraft(await api<Draft>(`/assistant/drafts/${draft.id}/answer`, { body: { answer } })) } finally { setBusy(false) }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); send(text) }

  const meta = useMeta()
  const last = draft?.messages[draft.messages.length - 1]
  const d = draft?.data ?? {}
  const multiline = draft?.step === 'describe' || draft?.step === 'wants'

  return (
    <div className="split split-side">
      <div className="card chat-wrap">
        <div className="chat-scroll" ref={scroller}>
          {draft?.messages.map((m, i) => m.role === 'assistant' ? (
            <div key={i}>
              <div className="bot-row"><div className="avatar"><LogoMark size={34} /></div><div className="bubble bot">{m.content}</div></div>
              {i === draft.messages.length - 1 && !draft.completed && m.choices.length > 0 && (
                <div className="choices">{m.choices.map(c => meta.categories.includes(c)
                  ? <CategoryChip key={c} name={c} description={describe(meta, c)} selected={false} disabled={busy} onSelect={() => send(c)} />
                  : <button key={c} className="chip" disabled={busy} onClick={() => send(c)}>{c}</button>)}</div>
              )}
            </div>
          ) : <div key={i} className="bubble me">{m.content}</div>)}
          {busy && <div className="bot-row"><div className="avatar"><LogoMark size={34} /></div><div className="bubble bot muted">입력 내용을 분석하고 있어요…</div></div>}
          {draft?.completed && draft.offer_id && (
            <div className="row" style={{ marginLeft: 40 }}>
              <Link className="btn btn-accent" to={`/offers/${draft.offer_id}`}>등록된 오퍼 보기</Link>
              <button className="btn" onClick={() => location.reload()}>새 오퍼 등록</button>
            </div>
          )}
        </div>
        {!draft?.completed && (
          <form className="composer" onSubmit={submit}>
            {multiline ? (
              <textarea className="textarea" style={{ minHeight: 64 }} placeholder="답변을 입력하세요 (Shift+Enter 줄바꿈)" value={text}
                onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }} />
            ) : (
              <input className="input" placeholder={last?.choices.length ? '선택하거나 직접 입력하세요' : '답변을 입력하세요'} value={text} onChange={e => setText(e.target.value)} />
            )}
            <button className="btn btn-primary" disabled={busy || !text.trim()}>전송</button>
          </form>
        )}
      </div>

      <div className="card card-pad stack draft-summary">
        <h3>작성 중인 오퍼</h3>
        <dl className="kv" style={{ gridTemplateColumns: '80px 1fr' }}>
          <dt>유형</dt><dd>{d.offer_type ? (d.offer_type === 'goods' ? '물품/재화' : '용역/서비스') : '—'}</dd>
          <dt>카테고리</dt><dd>{((d.category_names as string[] | undefined)?.join(' · ')) || (d.category as string) || '—'}</dd>
          <dt>제목</dt><dd>{(d.title as string) ?? '—'}</dd>
          <dt>수량/범위</dt><dd>{(d.quantity as string) || '—'}</dd>
          <dt>예상가치</dt><dd>{'estimated_value' in d ? won(d.estimated_value as number | null) : '—'}</dd>
          <dt>교환희망</dt><dd>{'want_mode' in d ? wantLabel({ wants: (d.wants as string) || '', want_cash: !!d.want_cash, want_cash_amount: (d.want_cash_amount as number | null) ?? null }) : '—'}</dd>
          <dt>현금정산</dt><dd>{d.want_cash ? '허용' : 'allow_cash' in d ? (d.allow_cash ? '허용' : '불가') : '—'}</dd>
          <dt>지역</dt><dd>{(d.region as string) ?? '—'}</dd>
        </dl>
        <p className="small muted">언제든 '이전 단계'로 돌아가 수정할 수 있습니다.</p>
      </div>
    </div>
  )
}

function OfferForm() {
  const nav = useNavigate()
  const meta = useMeta()
  const [cats, setCats] = useState<string[]>([])          // 첫 항목 = 대표 분야
  const [wantCats, setWantCats] = useState<string[]>([])
  const [manual, setManual] = useState(false)             // 직접 고르면 자동 분류 중지 (MasterBuy 와 동일)
  const [cls, setCls] = useState<{ busy: boolean; reason: string }>({ busy: false, reason: '' })
  const [retry, setRetry] = useState(0)
  const [f, setF] = useState({ offer_type: 'goods', title: '', description: '', quantity: '', estimated_value: '', wants: '', want_mode: 'goods', want_cash_amount: '', allow_cash: true, region: '전국', tags: '', days: '30' })
  const [err, setErr] = useState('')
  // 제목·설명을 입력하면 1.8초 뒤 자동 분류 (직접 선택하면 중지)
  const ready = (f.title + f.description).trim().length >= 5
  useEffect(() => {
    if (!ready || manual) return
    let alive = true
    const timer = setTimeout(() => {
      setCls({ busy: true, reason: '' })
      api<{ category_names: string[]; reason: string }>('/ai/offer-categories', { body: { title: f.title, description: f.description } })
        .then(r => { if (alive) { if (r.category_names.length) setCats(r.category_names); setCls({ busy: false, reason: r.reason }) } })
        .catch(e => { if (alive) setCls({ busy: false, reason: e.message || '자동 분류를 완료하지 못했습니다. 직접 선택해 주세요.' }) })
    }, 1800)
    return () => { alive = false; clearTimeout(timer) }
  }, [f.title, f.description, manual, ready, retry])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<any>) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('')
    if (!cats.length) { setErr('카테고리를 하나 이상 선택해 주세요.'); return }
    try {
      const o = await api('/offers', { body: {
        offer_type: f.offer_type, category: cats[0] ?? '', category_names: cats, want_categories: f.want_mode === 'cash' ? [] : wantCats, title: f.title, description: f.description, quantity: f.quantity,
        estimated_value: f.estimated_value ? Number(f.estimated_value.replace(/\D/g, '')) : null,
        wants: f.want_mode === 'cash' ? '' : f.wants,
        want_cash: f.want_mode !== 'goods',
        want_cash_amount: f.want_mode !== 'goods' && f.want_cash_amount ? Number(f.want_cash_amount.replace(/\D/g, '')) : null,
        allow_cash: f.want_mode !== 'goods' ? true : f.allow_cash, region: f.region, tags: f.tags.split(',').map(s => s.trim()).filter(Boolean),
        valid_until: new Date(Date.now() + Number(f.days) * 86400000).toISOString(),
      } })
      nav(`/offers/${o.id}`)
    } catch (e: any) { setErr(e.message) }
  }

  return (
    <form className="card card-pad stack" onSubmit={submit} style={{ maxWidth: 820 }}>
      {err && <div className="error">{err}</div>}
      <div className="grid-2">
        <div className="field"><label>유형</label><select className="select" value={f.offer_type} onChange={set('offer_type')}><option value="goods">물품/재화</option><option value="service">용역/서비스</option></select></div>
        <div className="field"><label>지역</label><select className="select" value={f.region} onChange={set('region')}>{meta.regions.map(c => <option key={c}>{c}</option>)}</select></div>
      </div>
      <div className="field"><label>제목 *</label><input className="input" value={f.title} onChange={set('title')} required minLength={2} /></div>
      <div className="field"><label>상세 설명</label><textarea className="textarea" value={f.description} onChange={set('description')} /></div>
      <section className="cat-select" aria-busy={cls.busy}>
        <header>
          <div><b>카테고리 *</b><p className="small muted">제목·설명을 분석해 자동 설정합니다. 여러 분야를 선택할 수 있으며 첫 번째 분야가 대표입니다.</p></div>
          <button type="button" className="btn btn-sm" disabled={!ready || cls.busy} onClick={() => { setManual(false); setRetry(x => x + 1) }}>{cls.busy ? '분류 중…' : '자동 분류 다시 실행'}</button>
        </header>
        <CategoryPicker value={cats} onChange={v => { setCats(v); setManual(true) }} />
        {cls.reason && <p className="small muted">{manual ? '직접 선택한 분야로 등록합니다.' : `자동 분류: ${cls.reason}`}</p>}
      </section>
      <div className="grid-3">
        <div className="field"><label>수량/범위</label><input className="input" value={f.quantity} onChange={set('quantity')} /></div>
        <div className="field"><label>예상 가치(원)</label><input className="input" inputMode="numeric" value={f.estimated_value} onChange={set('estimated_value')} /></div>
        <div className="field"><label>게시 기간(일)</label><input className="input" type="number" min={1} max={365} value={f.days} onChange={set('days')} /></div>
      </div>
      <div className="field">
        <label>교환으로 받고 싶은 것</label>
        <div className="chips">
          {([['goods', '재화·용역'], ['cash', '현금'], ['both', '재화·용역 + 현금']] as const).map(([v, l]) => (
            <button type="button" key={v} className={`chip ${f.want_mode === v ? 'on' : ''}`} onClick={() => setF({ ...f, want_mode: v })}>{l}</button>
          ))}
        </div>
      </div>
      {f.want_mode !== 'cash' && <div className="field"><label>교환 희망 재화·용역</label><textarea className="textarea" value={f.wants} onChange={set('wants')} /></div>}
      {f.want_mode !== 'cash' && (
        <div className="field">
          <label>교환 희망 분야 <span className="hint">선택 · 추천 매칭에 사용됩니다</span></label>
          <CategoryPicker value={wantCats} onChange={setWantCats} showPrimary={false} />
        </div>
      )}
      {f.want_mode !== 'goods' && (
        <div className="field">
          <label>{f.want_mode === 'cash' ? '희망 금액(원)' : '함께 받을 현금 희망 금액(원)'} <span className="hint">비워 두면 '금액 협의'</span></label>
          <input className="input" inputMode="numeric" placeholder="예: 5000000" value={f.want_cash_amount} onChange={set('want_cash_amount')} />
          {f.want_cash_amount && <span className="hint">{won(Number(f.want_cash_amount.replace(/\D/g, '')) || null)}</span>}
        </div>
      )}
      <div className="field"><label>키워드</label><input className="input" placeholder="쉼표로 구분" value={f.tags} onChange={set('tags')} /></div>
      {f.want_mode === 'goods' && <label className="row"><input type="checkbox" checked={f.allow_cash} onChange={set('allow_cash')} /> 가치 차이가 있을 때 현금 차액 정산 허용</label>}
      <div><button className="btn btn-primary">오퍼 등록</button></div>
    </form>
  )
}
