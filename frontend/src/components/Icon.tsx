const PATHS: Record<string, string> = {
  home: 'M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1z',
  search: 'M9 15A6 6 0 1 0 9 3a6 6 0 0 0 0 12zm4.5-1.5L17 17',
  plus: 'M10 4v12M4 10h12',
  box: 'M3 6.5 10 3l7 3.5v7L10 17l-7-3.5zM3 6.5 10 10l7-3.5M10 10v7',
  chat: 'M4 4h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  doc: 'M5 2.5h7l3.5 3.5V17a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5zM12 2.5V6h3.5M7.5 10h5M7.5 13h5',
  building: 'M4 17V3.5h8V17M12 8h4v9M2.5 17h15M6.5 6.5h3M6.5 9.5h3M6.5 12.5h3',
  shield: 'M10 2.5 16 5v5c0 3.5-2.6 6.3-6 7.5C6.6 16.3 4 13.5 4 10V5z M7.5 10l2 2 3.5-4',
  bell: 'M5 13V9a5 5 0 0 1 10 0v4l1.5 2h-13zM8.5 17.5h3',
  logout: 'M8 3H4v14h4M13 6l4 4-4 4M17 10H8',
  swap: 'M4 7h12l-3-3M16 13H4l3 3',
  back: 'M12.5 4 6.5 10l6 6',
  eye: 'M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6S1.5 10 1.5 10zM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  eyeOff: 'M3 3l14 14M8.2 5.2A7.6 7.6 0 0 1 10 5c5.5 0 8.5 5 8.5 5a14 14 0 0 1-2.4 2.9M5.5 6.6A13.6 13.6 0 0 0 1.5 10S4.5 15 10 15a7.8 7.8 0 0 0 3.6-.9M8.3 8.3a2.5 2.5 0 0 0 3.4 3.4',
  user: 'M10 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 17.5c.6-3.2 3.3-5 6.5-5s5.9 1.8 6.5 5',
  chevronDown: 'M5 8l5 5 5-5',
  check: 'M4.5 10.5l3.5 3.5 7.5-8',
  alert: 'M10 2.5 18 17H2zM10 8v4M10 14.5v.01',
  mail: 'M3 5h14v10H3zM3 5l7 6 7-6',
  lock: 'M5.5 9V6.5a4.5 4.5 0 0 1 9 0V9M4 9h12v8.5H4zM10 12.5v2',
}

export default function Icon({ name, size = 18 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}
