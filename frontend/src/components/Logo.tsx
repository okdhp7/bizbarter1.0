import { useId } from 'react'

/**
 * BizBarter 심볼 — MasterBuy 로고(보라 두 곡선이 맞물린 흐름 마크)를 적용.
 * 서로 다른 두 기업의 흐름이 맞물려 하나의 거래가 되는 모습.
 */
const ARC = 'M20 53C18.9 53 18 52.1 18 51C18 31.1 31.6 18 50 18H73.2C75 18 75.9 20.2 74.6 21.4L64.6 31.4C64.2 31.8 63.7 32 63.2 32H50C39.2 32 32 39.7 32 51C32 52.1 31.1 53 30 53H20Z'

export function LogoMark({ size = 32, onDark = false }: { size?: number; onDark?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const a = `bb-a-${uid}`, b = `bb-b-${uid}`
  return (
    <svg width={size} height={size} viewBox="14 14 68 68" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={a} x1="18" y1="53" x2="74" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor={onDark ? '#FFFFFF' : '#5135A3'} />
          <stop offset="1" stopColor={onDark ? '#EDE6FF' : '#8965DD'} />
        </linearGradient>
        <linearGradient id={b} x1="18" y1="53" x2="74" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor={onDark ? '#D9CDFD' : '#7955C5'} />
          <stop offset="1" stopColor={onDark ? '#B9A6F5' : '#B497E7'} />
        </linearGradient>
      </defs>
      <path d={ARC} fill={`url(#${a})`} />
      <path d={ARC} fill={`url(#${b})`} transform="rotate(180 48 48)" />
    </svg>
  )
}

/** 로그인 히어로 배경용 대형 워터마크 */
export function LogoWatermark({ size = 560, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="14 14 68 68" fill="none" aria-hidden="true">
      <path d={ARC} fill="#ffffff" fillOpacity=".10" />
      <path d={ARC} fill="#ffffff" fillOpacity=".06" transform="rotate(180 48 48)" />
    </svg>
  )
}

export function Logo({ onDark = false, sub = true }: { onDark?: boolean; sub?: boolean }) {
  return (
    <span className={`logo ${onDark ? 'on-dark' : ''}`}>
      <LogoMark size={36} onDark={onDark} />
      <span className="logo-text">
        <span className="logo-word">Biz<span>Barter</span></span>
        {sub && <span className="logo-sub">AI B2B Exchange</span>}
      </span>
    </span>
  )
}
