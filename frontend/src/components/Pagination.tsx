/**
 * 페이지네이션 — FindBid1.0 추천 입찰공고 페이지와 같은 구성·동작
 *  « 10 | 처음 … [5개 창] … 마지막 | 10 » | 페이지 [입력▴▾] / 전체 [이동]
 *  · 번호 창은 현재 페이지 기준 5개, 창 안의 1페이지·마지막 페이지는 '처음'·'마지막'으로 표시
 *  · ±10 페이지 이동, 번호 입력 이동(↑↓ 키·▴▾ 버튼으로 증감), 1페이지뿐이면 숨김
 */
import { useEffect, useRef, useState } from 'react'

const JUMP = 10

export default function Pagination({ page, total, onChange, disabled = false, label = '검색결과 페이지' }: {
  page: number; total: number; onChange: (p: number) => void; disabled?: boolean; label?: string
}) {
  const [jump, setJump] = useState(String(page))
  const prev = useRef(String(page))
  useEffect(() => { setJump(String(page)); prev.current = String(page) }, [page])

  if (total <= 1) return null

  const start = Math.max(1, Math.min(page - 2, Math.max(1, total - 4)))
  const end = Math.min(total, start + 4)
  const pages = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i)
  const go = (p: number) => { const n = Math.max(1, Math.min(total, p)); if (n !== page && !disabled) onChange(n) }
  const step = (d: number) => {
    const base = Number(jump || prev.current)
    const n = Math.max(1, Math.min(total, base + d))
    prev.current = String(n); setJump(String(n))
  }
  const fmt = (n: number) => n.toLocaleString('ko-KR')

  return (
    <nav className="pagination" aria-label={label}>
      <button type="button" className="pagination-direction" aria-label="이전 10페이지" disabled={page === 1 || disabled} onClick={() => go(page - JUMP)}>« 10</button>
      {start > 1 && (
        <>
          <button type="button" disabled={disabled} onClick={() => go(1)}>처음</button>
          {start > 2 && <span aria-hidden="true">…</span>}
        </>
      )}
      {pages.map(p => (
        <button type="button" key={p} className={p === page ? 'active' : ''} aria-current={p === page ? 'page' : undefined}
          disabled={disabled && p !== page} onClick={() => go(p)}>
          {p === 1 ? '처음' : p === total ? '마지막' : p}
        </button>
      ))}
      {end < total && (
        <>
          {end < total - 1 && <span aria-hidden="true">…</span>}
          <button type="button" disabled={disabled} onClick={() => go(total)}>마지막</button>
        </>
      )}
      <button type="button" className="pagination-direction" aria-label="다음 10페이지" disabled={page === total || disabled} onClick={() => go(page + JUMP)}>10 »</button>

      <form className="pagination-jump" aria-label="페이지 바로가기" onSubmit={e => {
        e.preventDefault()
        const n = Number(jump)
        if (!Number.isInteger(n) || n < 1 || n > total || disabled) return
        go(n); setJump(String(n))
      }}>
        <label htmlFor="page-jump">페이지</label>
        <div className="pagination-number-input">
          <input id="page-jump" type="number" inputMode="numeric" min={1} max={total} step={1} required value={jump}
            aria-label="이동할 페이지 번호" title={`1~${fmt(total)}페이지 입력`} disabled={disabled}
            onFocus={() => { prev.current = jump || String(page); setJump('') }}
            onChange={e => setJump(e.target.value)}
            onKeyDown={e => { if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return; e.preventDefault(); step(e.key === 'ArrowUp' ? 1 : -1) }}
            onBlur={() => { if (!jump.trim()) setJump(prev.current) }} />
          <div className="pagination-number-arrows">
            {[1, -1].map(d => (
              <button key={d} type="button" aria-label={d === 1 ? '페이지 번호 증가' : '페이지 번호 감소'} disabled={disabled}
                onMouseDown={e => e.preventDefault()} onClick={() => step(d)}>{d === 1 ? '▴' : '▾'}</button>
            ))}
          </div>
        </div>
        <span>/ {fmt(total)}</span>
        <button type="submit" disabled={disabled}>이동</button>
      </form>
    </nav>
  )
}
