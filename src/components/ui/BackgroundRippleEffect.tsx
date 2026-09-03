'use client';

import React from 'react';

export function BackgroundRippleEffect() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          opacity: 0.15,
          animation: 'rippleFloat 20s infinite alternate ease-in-out',
        }}
      >
        <defs>
          <radialGradient id="rippleGrad1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--mm-primary-light)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--mm-bg-body)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="rippleGrad2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--mm-primary-accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--mm-bg-body)" stopOpacity="0" />
          </radialGradient>
        </defs>
        
        <circle cx="20" cy="20" r="40" fill="url(#rippleGrad1)">
          <animate attributeName="cx" values="20; 30; 20" dur="15s" repeatCount="indefinite" />
          <animate attributeName="cy" values="20; 40; 20" dur="25s" repeatCount="indefinite" />
        </circle>
        
        <circle cx="80" cy="70" r="50" fill="url(#rippleGrad2)">
          <animate attributeName="cx" values="80; 60; 80" dur="20s" repeatCount="indefinite" />
          <animate attributeName="cy" values="70; 90; 70" dur="18s" repeatCount="indefinite" />
        </circle>
      </svg>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rippleFloat {
          0% { transform: scale(1); }
          100% { transform: scale(1.1); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}} />
    </div>
  );
}
