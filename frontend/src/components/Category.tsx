/**
 * 카테고리 칩·툴팁 — MasterBuy1.0 CategoryChip 과 같은 동작
 *  · 마우스를 올리거나 키보드 포커스하면 위쪽에 "분야명 + 포함 범위" 툴팁
 *  · 툴팁 위로 마우스를 옮겨도 유지, 바깥 클릭·ESC 로 닫힘, 화면 가장자리에서 자동 보정
 *  · 터치 기기: 길게 누르면 툴팁 (짧은 탭은 선택)
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../api'

export interface CategoryInfo { name: string; description: string; count?: number }
export interface Meta { categories: string[]; category_info: CategoryInfo[]; regions: string[] }

let metaCache: Promise<Meta> | null = null
/** /meta 를 한 번만 불러 공유 (카테고리 목록·설명·지역) */
export function loadMeta(force = false): Promise<Meta> {
  if (!metaCache || force) metaCache = api<Meta>('/meta').catch(e => { metaCache = null; throw e })
  return metaCache
}
export function useMeta(force = false) {
  const [meta, setMeta] = useState<Meta>({ categories: [], category_info: [], regions: [] })
  useEffect(() => { loadMeta(force).then(setMeta).catch(() => {}) }, [force])
  return meta
}
export const describe = (meta: Meta, name: string) => meta.category_info.find(c => c.name === name)?.description ?? ''

function useTooltip(description: string) {
  const anchor = useRef<HTMLSpanElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const press = useRef<ReturnType<typeof setTimeout>>()
  const longPressed = useRef(false)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ left: 0, top: 0, below: false })
  const visible = Boolean(description && open)

  const show = () => { clearTimeout(timer.current); setOpen(true) }
  const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 160) }
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(press.current) }, [])

  useEffect(() => {
    if (!visible) return
    const dismiss = (e: PointerEvent) => {
      if (!anchor.current?.contains(e.target as Node) && !tip.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { clearTimeout(timer.current); setOpen(false) } }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', esc) }
  }, [visible])

  useLayoutEffect(() => {
    if (!visible) return
    const place = () => {
      const r = anchor.current?.getBoundingClientRect()
      const t = tip.current
      if (!r || !t) return
      // MasterBuy 와 동일: 칩 묶음(여러 줄) 전체의 바깥에 띄워 다른 줄의 칩을 가리지 않음
      const g = anchor.current?.closest('.category-options, .chips, .choices')?.getBoundingClientRect() ?? r
      const left = Math.max(12, Math.min(r.left, window.innerWidth - t.offsetWidth - 12))
      const above = g.top - t.offsetHeight - 8
      const below = above < 12 && g.bottom + 8 + t.offsetHeight <= window.innerHeight - 12
      setPos({ left, top: below ? g.bottom + 8 : Math.max(12, above), below })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [visible, description])

  // 터치: 길게 누르면 툴팁
  const touch = {
    onTouchStart: () => { longPressed.current = false; press.current = setTimeout(() => { longPressed.current = true; show() }, 450) },
    onTouchEnd: () => clearTimeout(press.current),
    onTouchMove: () => clearTimeout(press.current),
  }
  return { anchor, tip, visible, pos, show, leave, setOpen, touch, longPressed }
}

function Tip({ id, name, description, t }: { id: string; name: string; description: string; t: ReturnType<typeof useTooltip> }) {
  if (!t.visible) return null
  return createPortal(
    <div ref={t.tip} id={id} role="tooltip" className={`category-tooltip ${t.pos.below ? 'below' : ''}`}
      style={{ left: t.pos.left, top: t.pos.top }} onMouseEnter={t.show} onMouseLeave={t.leave}>
      <strong>{name}</strong><span>{description}</span>
    </div>, document.body)
}

/** 선택형 카테고리 칩 (버튼) */
export function CategoryChip({ name, description, selected, onSelect, children, disabled }: {
  name: string; description: string; selected: boolean; onSelect: () => void; children?: ReactNode; disabled?: boolean
}) {
  const id = useId()
  const t = useTooltip(description)
  return (
    <span ref={t.anchor} className="category-chip" onMouseEnter={t.show} onMouseLeave={t.leave} onFocus={t.show}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) t.setOpen(false) }}>
      <button type="button" className={`chip ${selected ? 'on' : ''}`} aria-pressed={selected} disabled={disabled}
        aria-describedby={t.visible ? id : undefined} {...t.touch}
        onClick={e => { if (t.longPressed.current) { e.preventDefault(); t.longPressed.current = false; return } onSelect() }}>
        {name}{children}
      </button>
      <Tip id={id} name={name} description={description} t={t} />
    </span>
  )
}

/** 표시용 카테고리 태그 (오퍼 카드·상세) — 툴팁만 */
export function CategoryTag({ name, primary = false, className = '' }: { name: string; primary?: boolean; className?: string }) {
  const meta = useMeta()
  const description = describe(meta, name)
  const id = useId()
  const t = useTooltip(description)
  return (
    <span ref={t.anchor} className={`category-tag ${primary ? 'primary' : ''} ${className}`} tabIndex={description ? 0 : -1}
      aria-describedby={t.visible ? id : undefined} onMouseEnter={t.show} onMouseLeave={t.leave} onFocus={t.show} onBlur={() => t.setOpen(false)}
      onClick={e => { e.preventDefault(); e.stopPropagation(); t.show() }} {...t.touch}>
      {name}
      <Tip id={id} name={name} description={description} t={t} />
    </span>
  )
}

/** 복수 선택 + 대표 분야 (첫 항목) — MasterBuy MajorCategorySelector 와 같은 규칙 */
export function CategoryPicker({ value, onChange, showPrimary = true, max }: {
  value: string[]; onChange: (names: string[]) => void; showPrimary?: boolean; max?: number
}) {
  const meta = useMeta()
  const toggle = (n: string) => {
    if (value.includes(n)) return onChange(value.filter(x => x !== n))
    if (max && value.length >= max) return onChange([...value.slice(0, max - 1), n])
    onChange([...value, n])
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="chips category-options" role="group" aria-label="분야 복수 선택">
        {meta.category_info.map(c => (
          <CategoryChip key={c.name} name={c.name} description={c.description} selected={value.includes(c.name)} onSelect={() => toggle(c.name)}>
            {showPrimary && value[0] === c.name && <small className="chip-badge">대표</small>}
          </CategoryChip>
        ))}
      </div>
      {showPrimary && value.length > 1 && (
        <label className="row small" style={{ gap: 8 }}>
          <span className="muted">대표 분야</span>
          <select className="select" style={{ width: 'auto', height: 34 }} value={value[0]} onChange={e => onChange([e.target.value, ...value.filter(n => n !== e.target.value)])}>
            {value.map(n => <option key={n}>{n}</option>)}
          </select>
        </label>
      )}
    </div>
  )
}
