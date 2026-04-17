'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Database, Download, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BackupLog {
  id: number
  filename: string
  filePath: string | null
  fileSizeBytes: number | null
  status: string
  errorMessage: string | null
  createdAt: string
}

interface BackupCardProps {
  lastBackup: BackupLog | null
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getBackupAge(createdAt: string): { label: string; variant: 'ok' | 'warn' | 'danger' } {
  const now = Date.now()
  const ts = new Date(createdAt).getTime()
  const diffMs = now - ts
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays > 30) return { label: `${Math.floor(diffDays)} giorni fa`, variant: 'danger' }
  if (diffDays > 7) return { label: `${Math.floor(diffDays)} giorni fa`, variant: 'warn' }
  if (diffDays >= 1) return { label: `${Math.floor(diffDays)} giorn${diffDays >= 2 ? 'i' : 'o'} fa`, variant: 'ok' }
  const diffHours = diffMs / (1000 * 60 * 60)
  if (diffHours >= 1) return { label: `${Math.floor(diffHours)} or${diffHours >= 2 ? 'e' : 'a'} fa`, variant: 'ok' }
  const diffMin = Math.floor(diffMs / (1000 * 60))
  return { label: `${diffMin} minut${diffMin !== 1 ? 'i' : 'o'} fa`, variant: 'ok' }
}

export default function BackupCard({ lastBackup: initial }: BackupCardProps) {
  const [lastBackup, setLastBackup] = useState<BackupLog | null>(initial)
  const [loading, setLoading] = useState(false)

  async function runBackup() {
    setLoading(true)
    try {
      const res = await fetch('/api/backup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Errore durante il backup')
        return
      }
      setLastBackup({ ...data, createdAt: data.createdAt })
      toast.success('Backup completato', {
        description: data.filename,
      })
    } catch {
      toast.error('Errore di rete durante il backup')
    } finally {
      setLoading(false)
    }
  }

  const age = lastBackup && lastBackup.status === 'success' ? getBackupAge(lastBackup.createdAt) : null

  return (
    <div className="rounded-lg border bg-card p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold text-sm">Backup database</h2>
        </div>
        <Button size="sm" onClick={runBackup} disabled={loading}>
          <Download className="h-4 w-4 mr-1.5" />
          {loading ? 'Backup in corso…' : 'Esegui backup'}
        </Button>
      </div>

      {lastBackup ? (
        <div
          className={cn(
            'rounded-md border px-4 py-3 text-sm space-y-1',
            age?.variant === 'danger' && 'border-destructive/50 bg-destructive/10',
            age?.variant === 'warn' && 'border-yellow-400/50 bg-yellow-50 dark:bg-yellow-950/20',
            age?.variant === 'ok' && 'border-green-500/40 bg-green-50 dark:bg-green-950/20',
            lastBackup.status === 'error' && 'border-destructive/50 bg-destructive/10'
          )}
        >
          {lastBackup.status === 'success' ? (
            <>
              <div className="flex items-center gap-2 font-medium">
                {age?.variant === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                {age?.variant === 'warn' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                {age?.variant === 'danger' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                <span
                  className={cn(
                    age?.variant === 'ok' && 'text-green-700 dark:text-green-400',
                    age?.variant === 'warn' && 'text-yellow-700 dark:text-yellow-400',
                    age?.variant === 'danger' && 'text-destructive'
                  )}
                >
                  Ultimo backup: {age?.label}
                </span>
              </div>
              <p className="text-muted-foreground text-xs font-mono break-all">{lastBackup.filename}</p>
              {lastBackup.fileSizeBytes != null && (
                <p className="text-muted-foreground text-xs">
                  Dimensione: {formatBytes(lastBackup.fileSizeBytes)}
                </p>
              )}
              {lastBackup.filePath && (
                <p className="text-muted-foreground text-xs break-all">
                  Percorso: {lastBackup.filePath}
                </p>
              )}
            </>
          ) : (
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-destructive">Ultimo backup fallito</p>
                {lastBackup.errorMessage && (
                  <p className="text-xs text-muted-foreground mt-0.5">{lastBackup.errorMessage}</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-destructive font-medium">Nessun backup effettuato</span>
        </div>
      )}
    </div>
  )
}
