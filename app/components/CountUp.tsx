import React, { useState, useEffect, useRef, useCallback } from 'react';

interface CountUpProps {
  end: number;
  duration?: number;
  delay?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

const CountUp: React.FC<CountUpProps> = ({
  end,
  duration = 2000,
  delay = 0,
  className = '',
  prefix = '',
  suffix = '',
  decimals = 0
}) => {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const countRef = useRef<HTMLDivElement>(null);
  const endRef = useRef(end);
  const animationFrameRef = useRef<number | null>(null);

  const animateCount = useCallback(() => {
    // Cancel any existing animation
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startTime = Date.now();
    const startValue = count; // Start from current count instead of 0
    const targetEnd = endRef.current;

    const updateCount = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = startValue + (targetEnd - startValue) * easeOutQuart;

      setCount(Math.floor(currentValue));

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(updateCount);
      } else {
        setCount(targetEnd);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateCount);
  }, [count, duration]);

  // Update end ref when end prop changes
  useEffect(() => {
    endRef.current = end;
  }, [end]);

  // If end changes significantly after animation started, re-animate
  useEffect(() => {
    if (hasStarted && end > 0 && end !== count) {
      // If we have a real value and it's different from current count, animate to it
      animateCount();
    }
  }, [end, hasStarted, count, animateCount]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
          setTimeout(() => {
            animateCount();
          }, delay);
        }
      },
      { threshold: 0.1 }
    );

    if (countRef.current) {
      observer.observe(countRef.current);
    }

    return () => {
      if (countRef.current) {
        observer.unobserve(countRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [hasStarted, delay, animateCount]);

  const formatNumber = (num: number) => {
    if (decimals > 0) {
      return num.toFixed(decimals);
    }
    return num.toLocaleString();
  };

  return (
    <div ref={countRef} className={className}>
      {prefix}{formatNumber(count)}{suffix}
    </div>
  );
};

export default CountUp;
