import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/layout/AppLayout'
import ClientiTable from '@/components/anagrafica/ClientiTable'

export default async function ClientiPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const [clienti, committenti] = await Promise.all([
    prisma.cliente.findMany({
      orderBy: [{ committente: { ragioneSociale: 'asc' } }, { ragioneSociale: 'asc' }],
      include: {
        committente: { select: { id: true, ragioneSociale: true } },
        _count: { select: { attivita: true } },
      },
    }),
    prisma.committente.findMany({
      where: { attivo: true },
      orderBy: { ragioneSociale: 'asc' },
      select: { id: true, ragioneSociale: true },
    }),
  ])

  const clientiData = clienti.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <AppLayout>
      <ClientiTable clienti={clientiData} committenti={committenti} />
    </AppLayout>
  )
}
