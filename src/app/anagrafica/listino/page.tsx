export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import ListinoTable from '@/components/anagrafica/ListinoTable'
import AppLayout from '@/components/layout/AppLayout'

export const metadata = { title: 'Listino tariffe — PAM' }

export default async function ListinoPage() {
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
        <h1 className="text-xl font-semibold mb-3">Listino tariffe</h1>
        <ListinoTable committenti={committenti} tipiAttivita={tipiAttivita} />
      </div>
    </AppLayout>
  )
}
