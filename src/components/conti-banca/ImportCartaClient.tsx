'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export function ImportCartaClient() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number; ultimeCifre: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleImport() {
    if (!file) { toast.error('Seleziona un file Excel'); return }

    setLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/conti-banca/import-carta', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Errore importazione'); return }

      setResult(data)
      toast.success(`Importati ${data.imported} movimenti carta`)
    } catch {
      toast.error('Errore di rete')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-lg border p-5 space-y-4">
        <h2 className="font-semibold text-base">Importa movimenti carta di credito BPER</h2>

        <div className="space-y-1.5">
          <Label>File Excel (.xls / .xlsx) *</Label>
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Clicca per selezionare il file</p>
                <p className="text-xs text-muted-foreground">.xls, .xlsx</p>
              </div>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xls,.xlsx"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="rounded-md bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-800 dark:text-blue-200 space-y-1">
          <p className="font-medium">Formato atteso:</p>
          <p>Export &quot;Lista Movimenti Carta&quot; BPER (Pan Carta, Data operazione, Descrizione, Importo €, Stato).</p>
          <p>I movimenti &quot;PAGAMENTO CON ADDEBITO...&quot; (già contabilizzati sul conto) vengono esclusi automaticamente.</p>
          <p>La categoria viene impostata a &quot;CARTA + ultime 4 cifre&quot; letta dal campo Pan Carta.</p>
          <p>I movimenti già presenti vengono ignorati (nessun duplicato).</p>
        </div>

        <Button onClick={handleImport} disabled={loading || !file} className="w-full">
          {loading ? 'Importazione in corso…' : 'Avvia Importazione'}
        </Button>
      </div>

      {result && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800 p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-semibold">Importazione completata — Carta ****{result.ultimeCifre}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{result.imported}</div>
              <div className="text-muted-foreground">Movimenti importati</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground">{result.skipped}</div>
              <div className="text-muted-foreground">Già presenti (saltati)</div>
            </div>
          </div>
          <Link href="/conti-banca">
            <Button variant="outline" className="w-full">Vai ai Movimenti</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
