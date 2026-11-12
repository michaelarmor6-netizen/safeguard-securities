import type { ReactNode } from 'react';
import { useReveal } from './fragments';

/**
 * Entrance wrapper: heading, then text, then picture rise staggered as a
 * section enters. Falls back to visible when reduced motion is set.
 */
export function Reveal({
  children,
  className = '',
  style,
  as = 'div',
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: 'div' | 'section' | 'p' | 'figure';
}) {
  const ref = useReveal<HTMLDivElement>();
  const Tag = as as 'div';
  return (
    <Tag ref={ref} className={`sgs-reveal ${className}`.trim()} style={style}>
      {children}
    </Tag>
  );
}
