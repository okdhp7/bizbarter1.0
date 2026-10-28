import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import CompanyForm, { emptyCompany, type CompanyDraft } from '../components/CompanyForm'

export default function Profile() {
  const { user, refresh } = useAuth()
  const [c, setC] = useState<CompanyDraft>({ ...emptyCompany, ...(user?.company ?? {}) })
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const save = async () => {
    setMsg(''); setErr('')
    try {
      const { biz_reg_no, ...rest } = c
      await api('/me/company', { method: 'PUT', body: rest })
      await refresh()
      setMsg('저장되었습니다. 추천 결과에 즉시 반영됩니다.')
    } catch (e: any) { setErr(e.message) }
  }

  return (
    <>
      <div className="page-head">
        <div><h1>기업 프로필</h1><p>기업 특성 정보는 AI 맞춤 오퍼 추천과 상대 기업의 신뢰 판단에 사용됩니다.</p></div>
        <button className="btn btn-primary" onClick={save}>저장</button>
      </div>
      {msg && <div className="card card-pad" style={{ background: 'var(--teal-soft)', color: 'var(--teal)', marginBottom: 14 }}>{msg}</div>}
      {err && <div className="error" style={{ marginBottom: 14 }}>{err}</div>}
      <div style={{ maxWidth: 860 }}><CompanyForm value={c} onChange={setC} lockBrn /></div>
      <div style={{ marginTop: 16 }}><button className="btn btn-primary" onClick={save}>저장</button></div>
    </>
  )
}
