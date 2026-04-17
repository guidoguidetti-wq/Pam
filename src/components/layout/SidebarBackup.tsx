'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Database, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BackupLog {
  id: number
  filename: string
  status: string
  createdAt: string
}

function getAge(createdAt: string): { label: string; variant: 'ok' | 'warn' | 'danger' } {
  const diff = Date.now() - new Date(createdAt).getTime()
  const days = diff / 86400000
  if (days > 30) return { label: `${Math.floor(days)}g fa`, variant: 'danger' }
  if (days > 7)  return { label: `${Math.floor(days)}g fa`, variant: 'warn' }
  if (days >= 1) return { label: `${Math.floor(days)}g fa`, variant: 'ok' }
  const h = Math.floor(diff / 3600000)
  if (h >= 1)    return { label: `${h}h fa`, variant: 'ok' }
  return { label: `${Math.floor(diff / 60000)}m fa`, variant: 'ok' }
}

export default function SidebarBackup() {
  const [last, setLast] = useState<BackupLog | null | undefined>(undefined)
  const [running, setRunning] = useState(false)

  const load = useCallback(() => {
    fetch('/api/backup')
      .then((r) => r.json())
      .then(setLast)
      .catch(() => setLast(null))
  }, [])

  useEffect(() => { load() }, [load])

  async function run() {
    setRunning(true)
    try {
      const res = await fetch('/api/backup', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Errore backup'); return }
      setLast(data)
      toast.success('Backup completato')
    } catch {
      toast.error('Errore di rete')
    } finally {
      setRunning(false)
    }
  }

  const age = last && last.status === 'success' ? getAge(last.createdAt) : null

  const borderColor =
    !last || last.status === 'error' ? 'border-destructive/40' :
    age?.variant === 'danger' ? 'border-destructive/40' :
    age?.variant === 'warn'   ? 'border-yellow-400/60' :
                                'border-green-500/40'

  const Icon =
    !last || last.status === 'error' ? XCircle :
    age?.variant === 'danger' ? AlertTriangle :
    age?.variant === 'warn'   ? AlertTriangle :
                                CheckCircle2

  const iconColor =
    !last || last.status === 'error' ? 'text-destructive' :
    age?.variant === 'danger' ? 'text-destructive' :
    age?.variant === 'warn'   ? 'text-yellow-500' :
                                'text-green-500'

  return (
    <div className={cn('mx-2 mb-2 rounded-md border p-2.5 space-y-2', borderColor)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Database className="h-3.5 w-3.5 shrink-0" />
          <span>DB Backup</span>
        </div>
        <button
          onClick={run}
          disabled={running || last === undefined}
          className="text-[10px] font-medium px-2 py-0.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {running ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Esegui'}
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {last === undefined ? (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Icon className={cn('h-3.5 w-3.5 shrink-0', iconColor)} />
            <span className={cn('text-[11px] font-medium leading-tight', iconColor)}>
              {!last
                ? 'Mai eseguito'
                : last.status === 'error'
                ? 'Ultimo fallito'
                : age?.label}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
