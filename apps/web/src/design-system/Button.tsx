import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`apni-btn apni-btn--${variant} apni-btn--${size} ${className}`}
        {...props}
      >
        {isLoading && (
          <span className="apni-btn__spinner" aria-hidden="true" />
        )}
        {!isLoading && leftIcon && <span className="apni-btn__icon-left">{leftIcon}</span>}
        <span className="apni-btn__label">{children}</span>
        {!isLoading && rightIcon && <span className="apni-btn__icon-right">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
