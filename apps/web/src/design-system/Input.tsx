import React, { InputHTMLAttributes, forwardRef } from 'react';
import './Input.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className={`apni-input-group ${error ? 'has-error' : ''} ${className}`}>
        {label && (
          <label htmlFor={inputId} className="apni-input-label">
            {label}
            {props.required && <span className="apni-input-required">*</span>}
          </label>
        )}
        <div className="apni-input-wrapper">
          {leftIcon && <span className="apni-input-icon left">{leftIcon}</span>}
          <input
            id={inputId}
            ref={ref}
            className={`apni-input ${leftIcon ? 'has-left-icon' : ''} ${rightIcon ? 'has-right-icon' : ''}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            {...props}
          />
          {rightIcon && <span className="apni-input-icon right">{rightIcon}</span>}
        </div>
        {error && (
          <p id={`${inputId}-error`} className="apni-input-error" role="alert">
            {error}
          </p>
        )}
        {!error && helperText && <p className="apni-input-helper">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
