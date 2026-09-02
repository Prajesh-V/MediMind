'use client';

import { AppShell } from '@/components/layout/AppShell';
import type { NavItem } from '@/components/layout/Sidebar';

const patientNav: NavItem[] = [
  { key: 'home', icon: '🏠', labelKey: 'home', href: '/patient' },
  { key: 'profile', icon: '👤', labelKey: 'profile', href: '/patient/profile' },
  { key: 'meds', icon: '💊', labelKey: 'meds', href: '/patient/medications' },
  { key: 'prescription', icon: '📋', labelKey: 'prescription', href: '/patient/prescriptions' },
  { key: 'food', icon: '🥗', labelKey: 'food', href: '/patient/food' },
  { key: 'guidance', icon: '🍽', labelKey: 'guidance', href: '/patient/guidance' },
  { key: 'adr', icon: '⚕', labelKey: 'adr', href: '/patient/safety' },
  { key: 'settings', icon: '⚙', labelKey: 'settings', href: '/patient/settings' },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="patient" navItems={patientNav}>
      {children}
    </AppShell>
  );
}
