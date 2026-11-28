import type { ButtonHTMLAttributes } from 'react'

const icons = {
  stats: 'M4 18V6m0 12h16M7 14l4-4 3 2 5-6m-4 0h4v4',
  inventory: 'M4 7 12 3l8 4v10l-8 4-8-4Zm0 0 8 4 8-4m-8 4v10M8 5l8 4',
  journal: 'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16',
  pause: 'M9 5v14m6-14v14',
  lights: 'M11 5h2a7 7 0 0 1 0 14h-2ZM3 7h4m-5 5h5m-4 5h4',
  overdrive: 'M13 2 4 14h7l-1 8 10-12h-8Z',
  close: 'm6 6 12 12M18 6 6 18',
  panel: 'M4 5h16v14H4Zm9 0v14m3-10h1m-1 3h1m-1 3h1',
  expand: 'M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5M4 4l5 5m11-5-5 5M4 20l5-5m11 5-5-5',
  collapse: 'M4 9h5V4m11 5h-5V4M4 15h5v5m11-5h-5v5M4 4l5 5m11-5-5 5M4 20l5-5m11 5-5-5',
  settings: 'M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-7 2v4',
  info: 'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  exit: 'M12 3v9m5-7a8 8 0 1 1-10 0',
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  sell: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm2.5 5H11a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9.5M12 6v12',
  walk: 'M13 4.5a1.6 1.6 0 1 0 0-.01M11 21l1.5-5.5L10 13l1-4 3 1 2 3h3M10 9 7 11',
  shipyard: 'M12 3c3 2 4 5 4 9l3 3-3 1v3l-4-2-4 2v-3l-3-1 3-3c0-4 1-7 4-9Zm0 4v4',
} as const

export function ActionIcon({ icon }: { icon: keyof typeof icons }) {
  return <svg className="action-icon" aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={icons[icon]} /></svg>
}

export function IconButton({ icon, label, tooltip = label, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: keyof typeof icons; label: string; tooltip?: string
}) {
  return <button type="button" {...props} className={className ? `icon-button ${className}` : 'icon-button'} aria-label={label} data-tooltip={tooltip}>
    <ActionIcon icon={icon} />
  </button>
}
