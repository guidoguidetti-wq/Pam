export const dynamic = 'force-dynamic'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AppLayout from '@/components/layout/AppLayout'
import DashboardClient from '@/components/dashboard/DashboardClient'
import BackupCard from '@/components/dashboard/BackupCard'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const lastBackup = await prisma.backupLog.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  const lastBackupSerialized = lastBackup
    ? { ...lastBackup, createdAt: lastBackup.createdAt.toISOString() }
    : null

  return (
    <AppLayout>
      <div className="p-4 pb-0 max-w-2xl">
        <BackupCard lastBackup={lastBackupSerialized} />
      </div>
      <DashboardClient />
    </AppLayout>
  )
}
