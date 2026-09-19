import { ReactNode } from 'react';

export type IconName =
  | 'menu'
  | 'payments'
  | 'orders'
  | 'stock'
  | 'truck'
  | 'userPlus'
  | 'sun'
  | 'moon'
  | 'grid'
  | 'mail'
  | 'cloud'
  | 'bell'
  | 'logout'
  | 'user'
  | 'search'
  | 'users'
  | 'file'
  | 'cart'
  | 'package'
  | 'cog'
  | 'radio'
  | 'banknote'
  | 'star'
  | 'leaf'
  | 'shield'
  | 'sliders'
  | 'phone'
  | 'spark'
  | 'percent'
  | 'check'
  | 'refresh'
  | 'target'
  | 'clock'
  | 'link'
  | 'scale'
  | 'home'
  | 'chat'
  | 'pin'
  | 'key'
  | 'chevron';

const GLYPHS: Record<IconName, ReactNode> = {
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  payments: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  orders: <><path d="M7 4h7l4 4v12a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5.5A1.5 1.5 0 0 1 7 4Z" /><path d="M14 4v4.5H18M9 12h6M9 15.5h4" /></>,
  stock: <><path d="M3 8.5 12 4l9 4.5v11L12 20l-9-4.5v-11Z" /><path d="M12 20V9.5M3 8.5l9 4.5 9-4.5" /></>,
  truck: <><path d="M3 7h11v10H3zM14 11h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.6" /><circle cx="17.5" cy="18" r="1.6" /></>,
  userPlus: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M17 10v6M14 13h6" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M5 12H3M21 12h-2M6.2 6.2 4.8 4.8M19.2 19.2l-1.4-1.4M17.8 6.2l1.4-1.4M4.8 19.2l1.4-1.4" /></>,
  moon: <><path d="M17 13.5A6.5 6.5 0 1 1 10.5 7 5.2 5.2 0 0 0 17 13.5Z" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.2" /><rect x="13" y="4" width="7" height="7" rx="1.2" /><rect x="4" y="13" width="7" height="7" rx="1.2" /><rect x="13" y="13" width="7" height="7" rx="1.2" /></>,
  mail: <><rect x="3.5" y="6" width="17" height="12" rx="2" /><path d="m4 8 8 6 8-6" /></>,
  cloud: <><path d="M7 18h10a4 4 0 0 0 .3-8 5.5 5.5 0 0 0-10.6-1.2A3.5 3.5 0 0 0 7 18Z" /></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>,
  logout: <><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M15 8l5 4-5 4M9 12h11" /></>,
  user: <><circle cx="12" cy="8" r="3.2" /><path d="M5 19a7 7 0 0 1 14 0" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></>,
  users: <><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="9" r="2.2" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M14 19a4.2 4.2 0 0 1 6.5-2.8" /></>,
  file: <><path d="M7 4h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /><path d="M14 4v5h5" /></>,
  cart: <><path d="M4 5h2l2.2 10h9.3L20 8H8" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  package: <><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="M12 12 4 8M12 12l8-4M12 12v10" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M4.6 7.2l1.9 1.1M17.5 15.7l1.9 1.1M4.6 16.8l1.9-1.1M17.5 8.3l1.9-1.1M3.5 12H5.7M18.3 12h2.2" /></>,
  radio: <><path d="M5 15a7 7 0 0 1 14 0" /><path d="M8 16.5a4 4 0 0 1 8 0" /><circle cx="12" cy="18" r="1.3" /><path d="m8 6 8 4" /></>,
  banknote: <><rect x="3" y="7" width="18" height="11" rx="2" /><circle cx="12" cy="12.5" r="2" /><path d="M7 10.5v4M17 10.5v4" /></>,
  star: <><path d="m12 4 2.2 4.6L19 9.3l-3.5 3.4.8 4.8L12 15.4 7.7 17.5l.8-4.8L5 9.3l4.8-.7L12 4Z" /></>,
  leaf: <><path d="M5 19c8-1 13-8 14-14-6 1-13 6-14 14Z" /><path d="M8 16c2-3 5-6 9-8" /></>,
  shield: <><path d="M12 3 5 6v6c0 5 3.3 7.6 7 9 3.7-1.4 7-4 7-9V6l-7-3Z" /></>,
  sliders: <><path d="M5 7h8M17 7h2M5 17h2M11 17h8M13 4v6M7 14v6" /></>,
  phone: <><rect x="8" y="3" width="8" height="18" rx="2" /><path d="M11 18h2" /></>,
  spark: <><path d="M12 3v5M12 16v5M4.2 7.2 7.7 9.2M16.3 14.8l3.5 2M4.2 16.8l3.5-2M16.3 9.2l3.5-2" /><circle cx="12" cy="12" r="2.4" /></>,
  percent: <><circle cx="7.5" cy="7.5" r="2.2" /><circle cx="16.5" cy="16.5" r="2.2" /><path d="m6.5 17.5 11-11" /></>,
  check: <><circle cx="12" cy="12" r="8" /><path d="m8.5 12.2 2.4 2.4 4.6-5" /></>,
  refresh: <><path d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4L20 9" /><path d="M19.5 12a7.5 7.5 0 0 1-12.7 5.4L4 15" /><path d="M20 5v4h-4M4 19v-4h4" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1.2" /></>,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 1.8" /></>,
  link: <><path d="M9.5 14.5 7 17a3.2 3.2 0 0 1-4.5-4.5l2.5-2.5M14.5 9.5 17 7a3.2 3.2 0 1 1 4.5 4.5l-2.5 2.5M9 15l6-6" /></>,
  scale: <><path d="M12 4v16M8 20h8M12 7l-6 7h5l1-7Zm0 0 6 7h-5l-1-7Z" /></>,
  home: <><path d="m4 11 8-7 8 7v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20z" /><path d="M10 21.5V14h4v7.5" /></>,
  chat: <><path d="M5 17.5 4 21l3.8-1.4A8.5 8.5 0 1 0 5 17.5Z" /></>,
  pin: <><path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.2" /></>,
  key: <><circle cx="8" cy="15" r="3.5" /><path d="M11 13.5 20 5v3h-3v3h-2" /></>,
  chevron: <><path d="m9 6 6 6-6 6" /></>,
};

export function Icon({
  name,
  size = 18,
  className = '',
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={`erp-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {GLYPHS[name]}
    </svg>
  );
}
