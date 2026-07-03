interface RulerProps {
  orientation: 'h' | 'v';
  /** viewport size in px along the ruler */
  viewportPx: number;
  /** px position of canvas origin relative to the viewport */
  origin: number;
  zoom: number;
  canvasLength: number;
}

const RULER_SIZE = 22;

export function Ruler({ orientation, viewportPx, origin, zoom, canvasLength }: RulerProps) {
  const horizontal = orientation === 'h';
  const step = zoom >= 1 ? 50 : zoom >= 0.5 ? 100 : 200;
  const minor = step / 5;
  const ticks: JSX.Element[] = [];
  for (let u = 0; u <= canvasLength; u += minor) {
    const px = origin + u * zoom;
    if (px < RULER_SIZE - 4 || px > viewportPx + 4) continue;
    const isMajor = u % step === 0;
    const len = isMajor ? 10 : 5;
    if (horizontal) {
      ticks.push(
        <line
          key={u}
          x1={px}
          y1={RULER_SIZE}
          x2={px}
          y2={RULER_SIZE - len}
          stroke="#3d6a9c"
          strokeWidth={1}
        />,
      );
      if (isMajor) {
        ticks.push(
          <text key={`t${u}`} x={px + 3} y={9} fill="#547499" fontSize={8} fontFamily="Share Tech Mono">
            {u}
          </text>,
        );
      }
    } else {
      ticks.push(
        <line
          key={u}
          x1={RULER_SIZE}
          y1={px}
          x2={RULER_SIZE - len}
          y2={px}
          stroke="#3d6a9c"
          strokeWidth={1}
        />,
      );
      if (isMajor) {
        ticks.push(
          <text
            key={`t${u}`}
            x={9}
            y={px + 3}
            fill="#547499"
            fontSize={8}
            fontFamily="Share Tech Mono"
            transform={`rotate(-90 9 ${px + 3})`}
            textAnchor="end"
          >
            {u}
          </text>,
        );
      }
    }
  }
  return (
    <svg
      className={`ruler ruler--${orientation}`}
      width={horizontal ? viewportPx : RULER_SIZE}
      height={horizontal ? RULER_SIZE : viewportPx}
    >
      {ticks}
    </svg>
  );
}
