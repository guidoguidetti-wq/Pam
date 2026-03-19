export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/layout/AppLayout'
import CommitentiTable from '@/components/anagrafica/CommitentiTable'

export default async function CommitentiPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const committenti = await prisma.committente.findMany({
    orderBy: { ragioneSociale: 'asc' },
    include: { _count: { select: { clienti: true } } },
  })

  const data = committenti.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <AppLayout>
      <CommitentiTable committenti={data} />
    </AppLayout>
  )
}
