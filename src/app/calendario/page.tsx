export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import CalendarioView from '@/components/calendario/CalendarioView'
import { prisma } from '@/lib/prisma'

export default async function CalendarioPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const [committenti, tipiAttivita] = await Promise.all([
    prisma.committente.findMany({
      where: { attivo: true },
      orderBy: { ragioneSociale: 'asc' },
      select: { id: true, ragioneSociale: true },
    }),
    prisma.tipoAttivita.findMany({
      where: { attivo: true },
      orderBy: { id: 'asc' },
    }),
  ])

  return (
    <AppLayout>
      <CalendarioView committenti={committenti} tipiAttivita={tipiAttivita} />
    </AppLayout>
  )
}
