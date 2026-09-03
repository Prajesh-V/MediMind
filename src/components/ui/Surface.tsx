'use client';

import React from 'react';
import styles from './ui.module.css';

interface SurfaceProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'glass' | 'subtle';
  as?: React.ElementType;
}

export function Surface({ 
  children, 
  className = '', 
  style,
  padding = 'md', 
  variant = 'default',
  as: Component = 'div' 
}: SurfaceProps) {
  const baseClass = styles.surface;
  const paddingClass = styles[`padding-${padding}`];
  const variantClass = styles[`variant-${variant}`];
  
  return (
    <Component className={`${baseClass} ${paddingClass} ${variantClass} ${className}`} style={style}>
      {children}
    </Component>
  );
}
