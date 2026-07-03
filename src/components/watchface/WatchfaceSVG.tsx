import { useId } from 'react';
import type { Device, LiveData, WatchElement } from '@/types/watchface';
import { ElementNode } from './renderers';

interface Props {
  device: Device;
  elements: WatchElement[];
  background: string;
  data: LiveData;
  width?: number | string;
  className?: string;
  /** Dim overlay used to hint at AOD brightness limits */
  aodDim?: boolean;
}

export function deviceShapePath(device: Device): JSX.Element {
  if (device.shape === 'round') {
    return (
      <circle
        cx={device.width / 2}
        cy={device.height / 2}
        r={Math.min(device.width, device.height) / 2}
      />
    );
  }
  return (
    <rect
      width={device.width}
      height={device.height}
      rx={device.cornerRadius ?? 0}
    />
  );
}

/** Pure, non-interactive watchface render — used by previews, thumbnails and export. */
export function WatchfaceSVG({
  device,
  elements,
  background,
  data,
  width = '100%',
  className,
  aodDim = false,
}: Props) {
  const rawId = useId();
  const clipId = `wfclip-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg
      viewBox={`0 0 ${device.width} ${device.height}`}
      width={width}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>{deviceShapePath(device)}</clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width={device.width} height={device.height} fill={background} />
        {elements.map((el) => (
          <ElementNode key={el.id} el={el} data={data} />
        ))}
        {aodDim && (
          <rect
            width={device.width}
            height={device.height}
            fill="rgba(0,0,0,0.35)"
            pointerEvents="none"
          />
        )}
      </g>
    </svg>
  );
}
