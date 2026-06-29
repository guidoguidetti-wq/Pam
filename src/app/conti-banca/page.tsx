export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { ContiBancaClient } from '@/components/conti-banca/ContiBancaClient'

export default async function ContiBancaPage() {
  const session = await auth()
  if (!session) redirect('/login')

  return (
    <AppLayout>
      <div className="p-3 space-y-4">
        <h1 className="text-xl font-bold">Conti Banca</h1>
        <ContiBancaClient />
      </div>
    </AppLayout>
  )
}
