export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import { AttivitaTable } from '@/components/attivita/AttivitaTable'
import { prisma } from '@/lib/prisma'

export default async function AttivitaPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const [committenti, tipiAttivita] = await Promise.all([
    prisma.committente.findMany({
      where: { attivo: true },
      orderBy: { ragioneSociale: 'asc' },
      select: { id: true, ragioneSociale: true },
    }),
    prisma.tipoAttivita.findMany({
      orderBy: { id: 'asc' },
    }),
  ])

  return (
    <AppLayout>
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Attività</h1>
        <AttivitaTable committenti={committenti} tipiAttivita={tipiAttivita} />
      </div>
    </AppLayout>
  )
}
