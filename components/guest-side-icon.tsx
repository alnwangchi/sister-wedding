export type GuestSide = 'groom' | 'bride';

const SIDE_LABEL = {
  groom: { short: '男', full: '男方親友' },
  bride: { short: '女', full: '女方親友' },
} as const;

export function GuestSideLabel({
  side,
  variant = 'short',
}: {
  side: GuestSide;
  variant?: 'short' | 'full';
}) {
  const text = SIDE_LABEL[side][variant === 'short' ? 'short' : 'full'];
  const colorClass = side === 'groom' ? 'text-sky-600' : 'text-bride';
  return (
    <span className={`font-medium ${colorClass}`} title={SIDE_LABEL[side].full}>
      {text}
    </span>
  );
}
