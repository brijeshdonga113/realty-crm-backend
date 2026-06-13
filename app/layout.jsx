import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { ToastProvider } from '@/components/ui/Toast'
import { getThemeScript } from '@/lib/themes'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

// Prevent Next.js from statically prerendering any page — all pages depend on
// client-side Firebase auth which is unavailable at build time.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Cliniwayz',
  description: 'Cliniwayz — clinic management for doctors. Patient records, appointments, billing, and WhatsApp reminders in one place.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved color theme before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: getThemeScript() }} />
      </head>
      <body className="bg-gray-50 dark:bg-gray-900 min-h-screen font-sans">
        <AuthProvider>
          <NotificationsProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </NotificationsProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
