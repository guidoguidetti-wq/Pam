'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { CalendarDays, Building2, Users, Tag, FolderOpen, FileText, LogOut, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/attivita', label: 'Attività', icon: ListChecks },
  { href: '/anagrafica/committenti', label: 'Committenti', icon: Building2 },
  { href: '/anagrafica/clienti', label: 'Clienti', icon: Users },
  { href: '/anagrafica/listino', label: 'Listino', icon: Tag },
  { href: '/progetti', label: 'Progetti', icon: FolderOpen },
  { href: '/report', label: 'Report', icon: FileText },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-52 flex-col border-r bg-card shrink-0">
        <div className="px-4 py-4 border-b flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/api/logo" alt="PAM" className="h-10 w-auto object-contain" />
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                pathname.startsWith(href)
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-2 border-t">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Esci
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-auto pb-14 md:pb-0">
        {children}
      </div>

      {/* Bottom nav mobile */}
      <nav className="fixed bottom-0 inset-x-0 md:hidden bg-card border-t grid grid-cols-5 z-50">
        {nav.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 text-[10px]',
              pathname.startsWith(href) ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
