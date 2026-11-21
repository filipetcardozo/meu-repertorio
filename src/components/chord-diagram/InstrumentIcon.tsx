import React from 'react';

/**
 * Ícones dos instrumentos, todos no mesmo estilo (silhueta preenchida, currentColor).
 * Não há ícone pronto de cavaquinho e ukulele nas bibliotecas, então são desenhados aqui
 * com as proporções de cada um: violão grande, cavaco estreito de braço longo,
 * ukulele redondinho de braço curto.
 */

type Body = {
  lower: [cy: number, rx: number, ry: number];
  upper: [cy: number, rx: number, ry: number];
  neck: [top: number, bottom: number, width: number];
  head: [top: number, height: number, width: number];
  hole: [cy: number, r: number];
  bridgeY: number;
  pegs: number; // tarraxas por lado
};

const BODIES: Record<string, Body> = {
  guitar: {
    lower: [17.4, 5.4, 5], upper: [11.2, 4.1, 3.9],
    neck: [3.2, 9, 1.9], head: [0.4, 3.4, 3], hole: [13.4, 1.6], bridgeY: 19, pegs: 3,
  },
  cavaquinho: {
    lower: [18.6, 3.9, 3.9], upper: [14, 3, 2.9],
    neck: [3.4, 12, 1.5], head: [0.8, 3, 2.4], hole: [15.4, 1.15], bridgeY: 19.8, pegs: 2,
  },
  ukulele: {
    lower: [17.8, 4.6, 4.4], upper: [12.8, 3.9, 3.6],
    neck: [6.2, 10.5, 2], head: [3, 3.6, 3.4], hole: [14.2, 1.4], bridgeY: 19.4, pegs: 2,
  },
};

function Fretted({ body, maskId }: { body: Body; maskId: string }) {
  const [lcy, lrx, lry] = body.lower;
  const [ucy, urx, ury] = body.upper;
  const [nTop, nBottom, nW] = body.neck;
  const [hTop, hH, hW] = body.head;
  const pegGap = hH / (body.pegs + 1);
  return (
    <>
      <mask id={maskId}>
        <rect width='24' height='24' fill='#fff' />
        <circle cx='12' cy={body.hole[0]} r={body.hole[1]} fill='#000' />
        <rect x={12 - lrx * 0.42} y={body.bridgeY} width={lrx * 0.84} height='0.9' rx='0.45' fill='#000' />
      </mask>
      <g mask={`url(#${maskId})`}>
        <ellipse cx='12' cy={lcy} rx={lrx} ry={lry} />
        <ellipse cx='12' cy={ucy} rx={urx} ry={ury} />
        <rect x={12 - nW / 2} y={nTop} width={nW} height={nBottom - nTop + 1} />
        <rect x={12 - hW / 2} y={hTop} width={hW} height={hH} rx='0.8' />
        {Array.from({ length: body.pegs }, (_, i) => (
          <React.Fragment key={i}>
            <circle cx={12 - hW / 2 - 0.6} cy={hTop + pegGap * (i + 1)} r='0.6' />
            <circle cx={12 + hW / 2 + 0.6} cy={hTop + pegGap * (i + 1)} r='0.6' />
          </React.Fragment>
        ))}
      </g>
    </>
  );
}

function Keyboard({ maskId }: { maskId: string }) {
  // Teclado visto de cima: 5 brancas e 3 pretas
  const left = 2.5, width = 19, top = 5, height = 14;
  const w = width / 5;
  return (
    <>
      <mask id={maskId}>
        <rect width='24' height='24' fill='#fff' />
        {[1, 2, 3, 4].map((i) => (
          <rect key={i} x={left + i * w - 0.35} y={top + 1.2} width='0.7' height={height - 2.4} fill='#000' />
        ))}
        {[1, 2, 4].map((i) => (
          <rect key={`b${i}`} x={left + i * w - 1.5} y={top + 1.2} width='3' height={height * 0.55} rx='0.4' fill='#000' />
        ))}
      </mask>
      <g mask={`url(#${maskId})`}>
        <rect x={left} y={top} width={width} height={height} rx='1.6' />
      </g>
      {[1, 2, 4].map((i) => (
        <rect key={`k${i}`} x={left + i * w - 1.05} y={top + 1.2} width='2.1' height={height * 0.55 - 0.45} rx='0.3' />
      ))}
    </>
  );
}

export function InstrumentIcon({ id, size = 20 }: { id: string; size?: number }) {
  const maskId = `inst-${id}-${React.useId().replace(/:/g, '')}`;
  const body = BODIES[id];
  return (
    <svg width={size} height={size} viewBox='0 0 24 24' fill='currentColor' aria-hidden style={{ display: 'block', flexShrink: 0 }}>
      {body ? (
        // Inclinado, como o instrumento apoiado no corpo
        <g transform='rotate(35 12 12)'><Fretted body={body} maskId={maskId} /></g>
      ) : (
        <Keyboard maskId={maskId} />
      )}
    </svg>
  );
}
