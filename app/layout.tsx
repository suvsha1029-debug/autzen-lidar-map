import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Autzen · Field Atlas LiDAR Explorer',
  description: 'Explore open airborne LiDAR around Autzen Stadium in an interactive 3D map.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
