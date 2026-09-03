'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar, type NavItem } from './Sidebar';
import { TopBar } from './TopBar';
import { PatientNavbar } from './PatientNavbar';
import styles from './AppShell.module.css';

interface AppShellProps {
  role: 'patient' | 'professional';
  navItems: NavItem[];
  layoutMode?: 'sidebar' | 'navbar';
  children: ReactNode;
}

export function AppShell({ role, navItems, layoutMode = 'sidebar', children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Safely check viewport width on mount to default collapsed state if tablet.
    // This uses window only after mount to avoid hydration mismatch.
    if (window.innerWidth < 1200 && window.innerWidth >= 900) {
      setDesktopCollapsed(true);
    }
  }, []);

  // Optional: Auto-collapse on resize if moving into tablet range
  useEffect(() => {
    if (!isMounted) return;
    const handleResize = () => {
      if (window.innerWidth < 1200 && window.innerWidth >= 900) {
        setDesktopCollapsed(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMounted]);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Handle escape key for mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileNavOpen) {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileNavOpen]);

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const toggleMobileNav = useCallback(() => setMobileNavOpen((v) => !v), []);
  const toggleDesktopNav = useCallback(() => setDesktopCollapsed((v) => !v), []);

  if (layoutMode === 'navbar') {
    return (
      <div className={styles.appNavbarMode}>
        <PatientNavbar navItems={navItems} />
        <main className={styles.mainNavbarMode}>
          <div className={styles.contentNavbarMode}>
            {children}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={`${styles.app} ${desktopCollapsed ? styles.desktopCollapsed : ''}`}>
      {/* Desktop Sidebar */}
      <Sidebar 
        role={role} 
        navItems={navItems} 
        isCollapsed={desktopCollapsed} 
      />

      {/* Mobile overlay sidebar */}
      {mobileNavOpen && (
        <>
          <div className={styles.overlay} onClick={closeMobileNav} aria-hidden="true" />
          <div className={styles.mobileDrawer} role="dialog" aria-modal="true" aria-label="Mobile navigation">
            <Sidebar 
              role={role} 
              navItems={navItems} 
              onClose={closeMobileNav} 
              isCollapsed={false}
            />
          </div>
        </>
      )}

      <main className={styles.main}>
        <TopBar 
          role={role} 
          isCollapsed={desktopCollapsed}
          onMenuToggle={toggleMobileNav} 
          onDesktopToggle={toggleDesktopNav}
        />
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
}
