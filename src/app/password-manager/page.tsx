export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/layout/AppLayout'
import PasswordManagerView from '@/components/password-manager/PasswordManagerView'

export const metadata = { title: 'Password Manager — PAM' }

export default async function PasswordManagerPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const clienti = await prisma.cliente.findMany({
    where: { attivo: true },
    orderBy: [{ committente: { ragioneSociale: 'asc' } }, { ragioneSociale: 'asc' }],
    select: { id: true, ragioneSociale: true, committente: { select: { id: true, ragioneSociale: true } } },
  })

  return (
    <AppLayout>
      <div className="p-3">
        <h1 className="text-xl font-semibold mb-3">Password Manager</h1>
        <PasswordManagerView clienti={clienti} />
      </div>
    </AppLayout>
  )
}
