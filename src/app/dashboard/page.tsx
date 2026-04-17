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

  let lastBackupSerialized = null
  try {
    const lastBackup = await prisma.backupLog.findFirst({
      orderBy: { createdAt: 'desc' },
    })
    if (lastBackup) {
      lastBackupSerialized = { ...lastBackup, createdAt: lastBackup.createdAt.toISOString() }
    }
  } catch {
    // tabella backup_log non ancora creata (migration pending)
  }

  return (
    <AppLayout>
      <div className="p-4 pb-0 max-w-2xl">
        <BackupCard lastBackup={lastBackupSerialized} />
      </div>
      <DashboardClient />
    </AppLayout>
  )
}
