export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { FatturePagamentiClient } from '@/components/fatture-pagamenti/FatturePagamentiClient'

export default async function FatturePagamentiPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <AppLayout>
      <div className="p-3 space-y-4">
        <h1 className="text-xl font-bold">Fatture e Pagamenti</h1>
        <FatturePagamentiClient />
      </div>
    </AppLayout>
  )
}
