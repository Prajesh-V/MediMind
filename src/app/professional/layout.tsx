'use client';

import { AppShell } from '@/components/layout/AppShell';
import type { NavItem } from '@/components/layout/Sidebar';

const professionalNav: NavItem[] = [
  { key: 'dashboard', icon: '📊', labelKey: 'dashboard', href: '/professional' },
  { key: 'patients', icon: '👥', labelKey: 'patients', href: '/professional/patients' },
  { key: 'interactions', icon: '⚠️', labelKey: 'interactions', href: '/professional/interactions' },
  { key: 'guidance', icon: '🍽', labelKey: 'guidance', href: '/professional/guidance' },
  { key: 'safety', icon: '⚕', labelKey: 'adr', href: '/professional/safety' },
  { key: 'insights', icon: '✦', labelKey: 'insights', href: '/professional/insights' },
  { key: 'settings', icon: '⚙', labelKey: 'settings', href: '/professional/settings' },
];

export default function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="professional" navItems={professionalNav}>
      {children}
    </AppShell>
  );
}
