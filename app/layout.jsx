import './globals.css'
import { AuthProvider } from '@/context/AuthContext'

export const metadata = {
  title: 'ClinicCRM',
  description: 'Clinic management system for doctors — patient records, billing, and more.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-900 min-h-screen font-sans">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
