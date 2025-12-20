import React from 'react';
import classNames from 'classnames';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'base' | 'large';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'base',
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  className,
  disabled,
  children,
  ...props
}) => {
  const buttonClasses = classNames(
    'button',
    {
      [`button-${variant}`]: variant !== 'primary',
      [`button-${size}`]: size !== 'base',
      'button-loading': loading,
      'button-full': fullWidth,
      'button-icon': icon,
    },
    className
  );

  const isDisabled = disabled || loading;

  return (
    <button
      className={buttonClasses}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        // Loading state handled by CSS
        children
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <span className="icon">{icon}</span>
          )}
          {children}
          {icon && iconPosition === 'right' && (
            <span className="icon">{icon}</span>
          )}
        </>
      )}
    </button>
  );
};

export interface ButtonGroupProps {
  children: React.ReactNode;
  vertical?: boolean;
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  vertical = false,
  className
}) => {
  const groupClasses = classNames(
    'button-group',
    {
      'button-group-vertical': vertical,
    },
    className
  );

  return (
    <div className={groupClasses}>
      {children}
    </div>
  );
};