'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { Sidebar, type NavItem } from './Sidebar';
import { TopBar } from './TopBar';
import styles from './AppShell.module.css';

interface AppShellProps {
  role: 'patient' | 'professional';
  navItems: NavItem[];
  children: ReactNode;
}

export function AppShell({ role, navItems, children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((v) => !v), []);

  return (
    <div className={styles.app}>
      <Sidebar role={role} navItems={navItems} />

      {/* Mobile overlay sidebar */}
      {mobileNavOpen && (
        <>
          <div className={styles.overlay} onClick={closeMobileNav} aria-hidden="true" />
          <div className={styles.mobileDrawer}>
            <Sidebar role={role} navItems={navItems} onClose={closeMobileNav} />
          </div>
        </>
      )}

      <main className={styles.main}>
        <TopBar role={role} onMenuToggle={toggleMobileNav} />
        {children}
      </main>
    </div>
  );
}
