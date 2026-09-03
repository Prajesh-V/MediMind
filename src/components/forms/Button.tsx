import styles from './Button.module.css';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  children: ReactNode;
}

export function Button({ variant = 'primary', children, className, ...props }: ButtonProps) {
  return (
    <button
      className={`${styles.btn} ${styles[variant]} ${className ?? ''}`}
      {...props}
    >
      {children}
    </button>
  );
}
