'use client';

import { AppShell } from '@/components/layout/AppShell';
import type { NavItem } from '@/components/layout/Sidebar';

const professionalNav: NavItem[] = [
  { key: 'dashboard', icon: 'LayoutDashboard', labelKey: 'dashboard', href: '/professional', group: 'OVERVIEW' },
  { key: 'patients', icon: 'Users', labelKey: 'patients', href: '/professional/patients', group: 'OVERVIEW' },
  
  { key: 'interactions', icon: 'TriangleAlert', labelKey: 'interactions', href: '/professional/interactions', group: 'WORKFLOW' },
  { key: 'guidance', icon: 'BookOpen', labelKey: 'guidance', href: '/professional/guidance', group: 'WORKFLOW' },
  { key: 'safety', icon: 'Activity', labelKey: 'adr', href: '/professional/safety', group: 'WORKFLOW' },
  
  { key: 'insights', icon: 'Sparkles', labelKey: 'insights', href: '/professional/insights', group: 'AI INSIGHTS' },
];

export default function ProfessionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell role="professional" navItems={professionalNav}>
      {children}
    </AppShell>
  );
}
