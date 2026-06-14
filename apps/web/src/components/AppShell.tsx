'use client';

import { ShellLayout } from './ShellLayout';

export function AppShell({ children }: { children: React.ReactNode }) {
  return <ShellLayout>{children}</ShellLayout>;
}
