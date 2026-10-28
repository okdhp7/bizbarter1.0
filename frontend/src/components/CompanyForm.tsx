import { useState } from 'react'
import type { Company } from '../types'
import { CategoryPicker } from './Category'

export type CompanyDraft = Omit<Company, 'id'>

export const emptyCompany: CompanyDraft = {
  name: '', biz_reg_no: '', ceo_name: '', address: '', phone: '', website: '',
  founded_year: null, employees: null, annual_revenue: null,
  industry: '', business_areas: [], technologies: [], track_record: '', certifications: [],
  products: '', needs: '', interest_categories: [], description: '',
}

const list = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)

/** 사업자등록번호 입력 시 000-00-00000 형태로 자동 하이픈 */
export const fmtBrn = (s: string) => {
  const d = s.replace(/\D/g, '').slice(0, 10)
  return d.length <= 3 ? d : d.length <= 5 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

export default function CompanyForm({ value, onChange, lockBrn = false, section = 'all' }: { value: CompanyDraft; onChange: (v: CompanyDraft) => void; lockBrn?: boolean; section?: 'all' | 'basic' | 'traits' }) {
  const set = <K extends keyof CompanyDraft>(k: K, v: CompanyDraft[K]) => onChange({ ...value, [k]: v })
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\D/g, '')))
  const [lists, setLists] = useState({
    business_areas: value.business_areas.join(', '), technologies: value.technologies.join(', '), certifications: value.certifications.join(', '),
  })
  const setList = (k: keyof typeof lists, s: string) => { setLists({ ...lists, [k]: s }); set(k, list(s)) }

  const industryField = <div className="field"><label>주 사업분야 *</label><input className="input" value={value.industry} placeholder="예: 포장재 제조" onChange={e => set('industry', e.target.value)} required /></div>

  return (
    <div className="stack">
      {section !== 'traits' && (
      <fieldset className="fieldset stack">
        <legend>기본 정보</legend>
        <div className="grid-2">
          <div className="field"><label>기업명 *</label><input className="input" value={value.name} onChange={e => set('name', e.target.value)} required /></div>
          <div className="field"><label>사업자등록번호 *</label><input className="input" value={value.biz_reg_no} disabled={lockBrn} placeholder="000-00-00000" inputMode="numeric" onChange={e => set('biz_reg_no', fmtBrn(e.target.value))} required /></div>
          <div className="field"><label>대표자명 *</label><input className="input" value={value.ceo_name} onChange={e => set('ceo_name', e.target.value)} required /></div>
          {section === 'basic' && industryField}
          <div className="field"><label>대표 전화</label><input className="input" value={value.phone} onChange={e => set('phone', e.target.value)} /></div>
        </div>
        <div className="field"><label>주소</label><input className="input" value={value.address} onChange={e => set('address', e.target.value)} /></div>
        <div className="grid-3">
          <div className="field"><label>설립연도</label><input className="input" inputMode="numeric" value={value.founded_year ?? ''} onChange={e => set('founded_year', num(e.target.value))} /></div>
          <div className="field"><label>직원 수</label><input className="input" inputMode="numeric" value={value.employees ?? ''} onChange={e => set('employees', num(e.target.value))} /></div>
          <div className="field"><label>웹사이트</label><input className="input" value={value.website} onChange={e => set('website', e.target.value)} /></div>
        </div>
      </fieldset>
      )}

      {section !== 'basic' && (
      <fieldset className="fieldset stack">
        <legend>기업 특성 정보 <span className="small muted">— AI 맞춤 추천에 사용됩니다</span></legend>
        <div className="grid-2">
          {section !== 'traits' && industryField}
          <div className="field"><label>세부 사업분야</label><input className="input" value={lists.business_areas} placeholder="쉼표로 구분" onChange={e => setList('business_areas', e.target.value)} /></div>
        </div>
        <div className="field"><label>보유기술</label><input className="input" value={lists.technologies} placeholder="예: 골판지 성형, 생분해 완충재 (쉼표로 구분)" onChange={e => setList('technologies', e.target.value)} /></div>
        <div className="field"><label>사업 실적</label><textarea className="textarea" value={value.track_record} placeholder="주요 납품처, 수행 프로젝트, 생산 규모 등" onChange={e => set('track_record', e.target.value)} /></div>
        <div className="field"><label>인증·특허</label><input className="input" value={lists.certifications} placeholder="예: ISO 9001, 벤처기업 (쉼표로 구분)" onChange={e => setList('certifications', e.target.value)} /></div>
        <div className="grid-2">
          <div className="field"><label>제공 가능한 재화·용역</label><textarea className="textarea" value={value.products} placeholder="교환에 내놓을 수 있는 제품/서비스" onChange={e => set('products', e.target.value)} /></div>
          <div className="field"><label>필요한 재화·용역</label><textarea className="textarea" value={value.needs} placeholder="교환으로 얻고 싶은 것" onChange={e => set('needs', e.target.value)} /></div>
        </div>
        <div className="field">
          <label>관심 카테고리 <span className="hint">분야에 마우스를 올리면 포함 범위가 보입니다</span></label>
          <CategoryPicker value={value.interest_categories} onChange={v => set('interest_categories', v)} showPrimary={false} />
        </div>
        <div className="field"><label>기업 소개</label><textarea className="textarea" value={value.description} onChange={e => set('description', e.target.value)} /></div>
      </fieldset>
      )}
    </div>
  )
}
