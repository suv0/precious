import { PanelHeader } from './PanelHeader';

export function PanelLayout({
  children,
  showHeader = true,
}: {
  children: React.ReactNode;
  showHeader?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      {showHeader && <PanelHeader />}
      <main className="flex-1">{children}</main>
    </div>
  );
}
