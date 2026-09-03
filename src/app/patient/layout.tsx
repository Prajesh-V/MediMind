'use client';

import { AppShell } from '@/components/layout/AppShell';
import type { NavItem } from '@/components/layout/Sidebar';

const patientNav: NavItem[] = [
  { key: 'home', icon: 'Home', labelKey: 'home', href: '/patient', group: 'OVERVIEW' },
  { key: 'meds', icon: 'Pill', labelKey: 'meds', href: '/patient/medications', group: 'MEDICATIONS' },
  { key: 'prescriptions', icon: 'FileText', labelKey: 'prescriptions', href: '/patient/prescriptions', group: 'MEDICATIONS' },
  { key: 'food', icon: 'Utensils', labelKey: 'food', href: '/patient/food', group: 'FOOD & SAFETY' },
  { key: 'adr', icon: 'Activity', labelKey: 'adr', href: '/patient/safety', group: 'FOOD & SAFETY' },
  { key: 'assistant', icon: 'Sparkles', labelKey: 'insights', href: '/patient/assistant', group: 'ASSISTANT' },
  { key: 'settings', icon: 'Settings', labelKey: 'settings', href: '/patient/settings', group: 'ACCOUNT' },
];

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="patient" navItems={patientNav} layoutMode="navbar">
      {children}
    </AppShell>
  );
}
