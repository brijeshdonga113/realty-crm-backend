import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { NotificationsProvider } from '@/context/NotificationsContext'
import { ToastProvider } from '@/components/ui/Toast'
import { getThemeScript } from '@/lib/themes'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title: 'ClinicCRM',
  description: 'Clinic management system for doctors — patient records, billing, and more.',
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
      </body>
    </html>
  )
}
