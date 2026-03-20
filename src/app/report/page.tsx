export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { ReportPageClient } from '@/components/report/ReportPageClient'
import { prisma } from '@/lib/prisma'

export default async function ReportPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const committenti = await prisma.committente.findMany({
    where: { attivo: true },
    orderBy: { ragioneSociale: 'asc' },
    select: { id: true, ragioneSociale: true },
  })

  return (
    <AppLayout>
      <div className="p-3 space-y-4">
        <h1 className="text-xl font-bold">Report</h1>
        <ReportPageClient committenti={committenti} />
      </div>
    </AppLayout>
  )
}
