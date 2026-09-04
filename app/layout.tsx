import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'NodeCine', description: 'The open-source node-based agentic video studio' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
