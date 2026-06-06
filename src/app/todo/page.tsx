export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AppLayout from '@/components/layout/AppLayout'
import TodoBoard from '@/components/todo/TodoBoard'
import { prisma } from '@/lib/prisma'

export default async function TodoPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const [committenti, clienti] = await Promise.all([
    prisma.committente.findMany({
      where: { attivo: true },
      select: { id: true, ragioneSociale: true },
      orderBy: { ragioneSociale: 'asc' },
    }),
    prisma.cliente.findMany({
      where: { attivo: true },
      select: { id: true, ragioneSociale: true, committenteId: true },
      orderBy: { ragioneSociale: 'asc' },
    }),
  ])

  return (
    <AppLayout>
      <TodoBoard committenti={committenti} clienti={clienti} />
    </AppLayout>
  )
}
