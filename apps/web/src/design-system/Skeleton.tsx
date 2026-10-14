import React from 'react';
import './Skeleton.css';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  className = ''
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: width ?? (variant === 'circular' ? '40px' : '100%'),
    height: height ?? (variant === 'text' ? '16px' : variant === 'circular' ? '40px' : '100px'),
  };

  return (
    <div
      className={`apni-skeleton apni-skeleton--${variant} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="apni-table-skeleton">
      <div className="apni-table-skeleton__header">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height="20px" width="70%" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="apni-table-skeleton__row">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height="16px" width={c === 0 ? '90%' : '60%'} />
          ))}
        </div>
      ))}
    </div>
  );
}
