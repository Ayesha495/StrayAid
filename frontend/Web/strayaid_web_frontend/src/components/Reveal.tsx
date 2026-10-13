import React, { useEffect, useRef, useState } from 'react';

interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stagger offset in ms, so siblings animate in one after another. */
  delay?: number;
  /** Adds the pointer-driven 3D tilt + spotlight hover effect (mouse only). */
  tilt?: boolean;
}

const MAX_TILT_DEG = 9;

/**
 * Fades + rises into view the first time it scrolls onto the screen and,
 * with `tilt`, leans toward the pointer with a spotlight that follows it.
 * Falls back to "already visible" where IntersectionObserver is missing.
 */
const Reveal: React.FC<RevealProps> = ({
  delay = 0,
  tilt = false,
  className = '',
  style,
  children,
  ...rest
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = ref.current;
    if (!element || event.pointerType !== 'mouse') {
      return;
    }
    const rect = element.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    element.style.setProperty('--mx', `${x}px`);
    element.style.setProperty('--my', `${y}px`);
    element.style.setProperty('--ry', `${(x / rect.width - 0.5) * 2 * MAX_TILT_DEG}deg`);
    element.style.setProperty('--rx', `${(0.5 - y / rect.height) * 2 * MAX_TILT_DEG}deg`);
  };

  const handlePointerLeave = () => {
    const element = ref.current;
    if (!element) {
      return;
    }
    element.style.setProperty('--rx', '0deg');
    element.style.setProperty('--ry', '0deg');
  };

  const classes = ['reveal', visible ? 'is-visible' : '', tilt ? 'is-tilt' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      className={classes}
      style={{ ...style, ['--reveal-delay' as string]: `${delay}ms` }}
      onPointerMove={tilt ? handlePointerMove : undefined}
      onPointerLeave={tilt ? handlePointerLeave : undefined}
      {...rest}
    >
      {children}
    </div>
  );
};

export default Reveal;
