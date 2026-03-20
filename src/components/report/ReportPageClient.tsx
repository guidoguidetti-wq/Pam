'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FileDown, Loader2 } from 'lucide-react'

interface Committente {
  id: number
  ragioneSociale: string
}

interface ReportPageClientProps {
  committenti: Committente[]
}

function primoGiornoMese(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function oggiStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function ReportPageClient({ committenti }: ReportPageClientProps) {
  const [from, setFrom] = useState(primoGiornoMese())
  const [to, setTo] = useState(oggiStr())
  const [committenteId, setCommittenteId] = useState('')
  const [includeSpese, setIncludeSpese] = useState(true)
  const [loading, setLoading] = useState(false)

  async function handleGenera() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ from, to, include_spese: includeSpese ? '1' : '0' })
      if (committenteId) params.set('committente_id', committenteId)

      const res = await fetch(`/api/report?${params}`)

      if (res.status === 404) {
        toast.warning('Nessuna attività nel periodo selezionato')
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        toast.error(body.error ?? 'Errore generazione report')
        return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const fromLabel = from.replace(/-/g, '')
      const toLabel = to.replace(/-/g, '')
      a.href = url
      a.download = `report-${fromLabel}-${toLabel}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Report generato')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Dal</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Al</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Committente</Label>
        <Select
          value={committenteId || '__all__'}
          onValueChange={(v) => setCommittenteId(v === '__all__' ? '' : v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Tutti i committenti" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tutti i committenti</SelectItem>
            {committenti.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.ragioneSociale}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="include-spese"
          checked={includeSpese}
          onCheckedChange={setIncludeSpese}
        />
        <Label htmlFor="include-spese" className="cursor-pointer">
          Includi riepilogo spese e allegati
        </Label>
      </div>

      <Button onClick={handleGenera} disabled={loading} size="lg">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generazione in corso...
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4 mr-2" />
            Genera PDF
          </>
        )}
      </Button>
    </div>
  )
}
