export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { CategorieClient } from '@/components/conti-banca/CategorieClient'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function CategoriePage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <AppLayout>
      <div className="p-3 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/conti-banca" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold">Gestione Categorie Enti</h1>
        </div>
        <CategorieClient />
      </div>
    </AppLayout>
  )
}
