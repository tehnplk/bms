import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Smart GIS',
  description: 'Addon App บนมาตรฐาน BMS Session API สำหรับแสดงและจัดการพิกัดบ้านในเขตรับผิดชอบของ HOSxP พัฒนาด้วย Next.js และ Leaflet GIS',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Prompt:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ToastProvider>
          <div id="app-container">
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
