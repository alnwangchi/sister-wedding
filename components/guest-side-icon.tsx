import { Mars, Venus } from 'lucide-react';

export type GuestSide = 'groom' | 'bride';

export function GuestSideIcon({
  side,
  className = 'size-4',
}: {
  side: GuestSide;
  className?: string;
}) {
  const colorClass = side === 'groom' ? 'text-sky-600' : 'text-pink-500';
  const Icon = side === 'groom' ? Mars : Venus;
  return <Icon aria-hidden='true' className={`${className} shrink-0 ${colorClass}`} />;
}

export function GuestSideLabel({ side }: { side: GuestSide }) {
  const text = side === 'groom' ? '男方' : '女方';
  return (
    <span className='inline-flex items-center gap-1.5' title={text}>
      <GuestSideIcon side={side} />
      {/* <span>{text}</span> */}
    </span>
  );
}
