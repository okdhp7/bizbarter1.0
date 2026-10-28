import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, dt } from '../api'
import { useAuth } from '../auth'
import { Badge } from '../components/ui'
import type { Deal } from '../types'

export default function DealDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [d, setD] = useState<Deal | null>(null)
  const [signer, setSigner] = useState(user?.name ?? '')
  const [agree, setAgree] = useState(false)
  const [method, setMethod] = useState('escrow')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { api<Deal>(`/deals/${id}`).then(setD).catch(e => setErr(e.message)) }, [id])

  const act = async (path: string, body?: unknown) => {
    setErr(''); setBusy(true)
    try { setD(await api<Deal>(`/deals/${id}/${path}`, { method: 'POST', body })) } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }

  if (!d) return <div className="empty">{err || '불러오는 중…'}</div>
  const me = d.my_side
  const mySigned = me === 'owner' ? d.owner_signed_at : d.buyer_signed_at
  const myDelivered = me === 'owner' ? d.owner_delivered_at : d.buyer_delivered_at
  const pending = d.payments.find(p => p.status === 'pending')
  const iPay = pending && pending.payer_company_id === user?.company_id
  const hasCash = Number(d.terms.cash_amount || 0) > 0
  const order = ['contract_pending', 'payment_pending', 'in_progress', 'completed']
  const cur = order.indexOf(d.status)
  const stepCls = (i: number) => (d.status === 'cancelled' ? '' : i < cur || d.status === 'completed' ? 'done' : i === cur ? 'cur' : '')

  return (
    <>
      <div className="row small muted" style={{ marginBottom: 10 }}><Link to="/deals">거래·계약</Link> › {d.deal_no}</div>
      <div className="page-head">
        <div>
          <div className="row" style={{ marginBottom: 6 }}><Badge kind="deal" value={d.status} /></div>
          <h1>{d.deal_no}</h1>
          <p>{d.owner_company.name} ⇄ {d.buyer_company.name} · <Link to={`/negotiations/${d.negotiation_id}`} style={{ color: 'var(--teal)' }}>협상 내역</Link></p>
        </div>
        {(d.status === 'contract_pending' || d.status === 'payment_pending') && (
          <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => window.confirm('거래를 취소하고 협상으로 돌아갈까요?') && act('cancel')}>거래 취소</button>
        )}
      </div>

      <div className="card steps">
        <div className={`step ${stepCls(0)}`} data-n="1">계약서 서명</div>
        <div className={`step ${stepCls(1)}`} data-n="2">{hasCash ? '차액 결제' : '결제 없음'}</div>
        <div className={`step ${stepCls(2)}`} data-n="3">교환 이행</div>
        <div className={`step ${stepCls(3)}`} data-n="4">거래 완료</div>
      </div>
      {err && <div className="error" style={{ marginBottom: 14 }}>{err}</div>}

      <div className="split split-wide">
        <div className="card card-pad stack">
          <div className="row"><h3>계약서</h3><span className="spacer" /><button className="btn btn-sm" onClick={() => {
            const w = window.open('', '_blank'); if (w) { w.document.write(`<pre style="font-family:sans-serif;white-space:pre-wrap;padding:40px;line-height:1.8">${d.contract_text.replace(/</g, '&lt;')}\n\n갑 서명: ${d.owner_signer || '(미서명)'} ${d.owner_signed_at ?? ''}\n을 서명: ${d.buyer_signer || '(미서명)'} ${d.buyer_signed_at ?? ''}</pre>`); w.print() }
          }}>인쇄/PDF</button></div>
          <div className="contract">{d.contract_text}</div>
          <dl className="kv">
            <dt>갑 서명</dt><dd>{d.owner_signed_at ? `${d.owner_signer} · ${dt(d.owner_signed_at, true)}` : '대기'}</dd>
            <dt>을 서명</dt><dd>{d.buyer_signed_at ? `${d.buyer_signer} · ${dt(d.buyer_signed_at, true)}` : '대기'}</dd>
          </dl>
        </div>

        <div className="stack">
          {d.status === 'contract_pending' && (
            <div className="card card-pad stack">
              <h3>전자서명</h3>
              {mySigned ? <p className="muted">서명을 완료했습니다. 상대방의 서명을 기다리고 있습니다.</p> : <>
                <div className="field"><label>서명자 성명</label><input className="input" value={signer} onChange={e => setSigner(e.target.value)} /></div>
                <label className="row small"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /> 계약서 내용을 확인했으며 이에 동의합니다.</label>
                <button className="btn btn-primary" disabled={!agree || !signer || busy} onClick={() => act('sign', { signer_name: signer, agree })}>계약서 서명</button>
              </>}
            </div>
          )}
          {d.status === 'payment_pending' && pending && (
            <div className="card card-pad stack">
              <h3>차액 결제</h3>
              <dl className="kv">
                <dt>결제 금액</dt><dd><b>{pending.amount.toLocaleString()}원</b></dd>
                <dt>수수료</dt><dd>{pending.fee.toLocaleString()}원 (지급인 부담)</dd>
                <dt>지급인</dt><dd>{pending.payer_company_id === d.owner_company_id ? d.owner_company.name : d.buyer_company.name}</dd>
              </dl>
              {iPay ? <>
                <select className="select" value={method} onChange={e => setMethod(e.target.value)}>
                  <option value="escrow">에스크로 (권장 · 이행 완료 후 지급)</option><option value="transfer">계좌이체</option><option value="card">법인카드</option>
                </select>
                <button className="btn btn-accent" disabled={busy} onClick={() => act('pay', { method })}>{(pending.amount + pending.fee).toLocaleString()}원 결제하기</button>
                <p className="small muted">※ 데모 환경에서는 모의 결제로 처리됩니다.</p>
              </> : <p className="muted">상대 기업의 결제를 기다리고 있습니다.</p>}
            </div>
          )}
          {d.status === 'in_progress' && (
            <div className="card card-pad stack">
              <h3>교환 이행</h3>
              <dl className="kv">
                <dt>{d.owner_company.name}</dt><dd>{d.owner_delivered_at ? `${dt(d.owner_delivered_at, true)}` : '이행 중'}</dd>
                <dt>{d.buyer_company.name}</dt><dd>{d.buyer_delivered_at ? `${dt(d.buyer_delivered_at, true)}` : '이행 중'}</dd>
              </dl>
              {myDelivered ? <p className="muted">이행 완료를 등록했습니다.</p> :
                <button className="btn btn-teal" disabled={busy} onClick={() => act('deliver')}>우리측 이행 완료 등록</button>}
            </div>
          )}
          {d.status === 'completed' && <div className="card card-pad"><h3>거래 완료</h3><p className="muted">{dt(d.completed_at, true)}에 모든 절차가 완료되었습니다.</p></div>}
          <div className="card card-pad stack">
            <h3>합의 조건</h3>
            <dl className="kv">
              <dt>{d.owner_company.name}</dt><dd>{d.terms.owner_gives}</dd>
              <dt>{d.buyer_company.name}</dt><dd>{d.terms.buyer_gives}</dd>
              <dt>차액</dt><dd>{hasCash ? `${Number(d.terms.cash_amount).toLocaleString()}원 (${d.terms.cash_payer === 'owner' ? d.owner_company.name : d.buyer_company.name} 지급)` : '없음'}</dd>
              <dt>이행 기한</dt><dd>{d.terms.delivery_date || '계약 후 30일'}</dd>
            </dl>
            {d.payments.filter(p => p.status === 'paid').map(p => (
              <div key={p.id} className="small muted">결제 완료 · {p.amount.toLocaleString()}원 · {p.method} · {p.pg_tid}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
