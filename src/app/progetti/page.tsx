export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import ProgettiTable from '@/components/progetti/ProgettiTable'
import AppLayout from '@/components/layout/AppLayout'

export const metadata = { title: 'Progetti — PAM' }

export default async function ProgettiPage() {
  const [committenti, tipiAttivita] = await Promise.all([
    prisma.committente.findMany({
      where: { attivo: true },
      orderBy: { ragioneSociale: 'asc' },
      select: { id: true, ragioneSociale: true },
    }),
    prisma.tipoAttivita.findMany({
      where: { attivo: true },
      orderBy: { id: 'asc' },
      select: { id: true, codice: true, descrizione: true },
    }),
  ])

  return (
    <AppLayout>
      <div className="p-3">
        <h1 className="text-xl font-semibold mb-3">Progetti</h1>
        <ProgettiTable committenti={committenti} tipiAttivita={tipiAttivita} />
      </div>
    </AppLayout>
  )
}
