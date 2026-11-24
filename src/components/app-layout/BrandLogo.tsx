import * as React from 'react';

type Props = {
  size?: number;
  title?: string;
};

// Contorno da palheta (ponta para baixo), num quadro de 100x100.
const PICK = 'M50 96 C40 86 8 52 8 30 C8 12 26 4 50 4 C74 4 92 12 92 30 C92 52 60 86 50 96 Z';

/**
 * Ícone do Toca Mais Uma: a palheta "+1" (o pedido de bis), com os risquinhos da galera gritando.
 * Mesmo desenho de public/logo.svg, inline para não depender de requisição e para cada instância ter seu gradiente.
 */
export const BrandLogo: React.FC<Props> = ({ size = 32, title }) => {
  const gradientId = `brand-logo-${React.useId().replace(/:/g, '')}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 120 120'
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      style={{ flexShrink: 0, display: 'block' }}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gradientId} x1='0' y1='0' x2='1' y2='1'>
          <stop offset='0' stopColor='#D946EF' />
          <stop offset='.55' stopColor='#7C3AED' />
          <stop offset='1' stopColor='#4F46E5' />
        </linearGradient>
      </defs>
      <g stroke='#C026D3' strokeWidth='5' strokeLinecap='round'>
        <path d='M99 16 L106 8' />
        <path d='M106 31 L116 28' />
        <path d='M90 9 L92 0' />
      </g>
      <g transform='rotate(-10 60 60) translate(10 10)'>
        <path d={PICK} fill={`url(#${gradientId})`} />
        <g fill='#fff'>
          <rect x='20' y='34' width='26' height='9' rx='4.5' />
          <rect x='28.5' y='25.5' width='9' height='26' rx='4.5' />
          <path
            d='M54 31 L64 24 H71 V54 H62 V35.5 L57.5 38.5 Z'
            stroke='#fff'
            strokeWidth='2'
            strokeLinejoin='round'
          />
        </g>
      </g>
    </svg>
  );
};
