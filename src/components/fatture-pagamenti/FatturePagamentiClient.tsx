'use client'

import { useRef, useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { FileText, CreditCard, Upload, X, CheckCircle2, BarChart3, Download, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Fattura {
  numero: string
  data: string
  cliente: string
  totale: number
}

interface Movimento {
  dataOperazione: string
  descrizione: string
  entrate: number
}

type StatoRiconciliazione = 'pagata' | 'importo_diverso' | 'trovata_per_importo' | 'non_pagata'

interface RigaRiconciliazione {
  fattura: Fattura
  movimento: Movimento | null
  tipoMatch: 'numero' | 'importo' | null
  differenza: number
  stato: StatoRiconciliazione
}

interface ParsedDataset {
  data: Fattura[] | Movimento[]
  filename: string
  count: number
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function parseImporto(val: unknown): number {
  if (typeof val === 'number') return val
  if (!val) return 0
  const s = String(val)
    .replace(/[€\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  return parseFloat(s) || 0
}

function parseFatture(ws: XLSX.WorkSheet): Fattura[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  if (data.length < 2) return []
  const headers = (data[0] as string[]).map(h => String(h).trim())
  const idx = {
    numero:  headers.findIndex(h => h === 'Numero'),
    data:    headers.findIndex(h => h === 'Data'),
    cliente: headers.findIndex(h => h === 'Cliente'),
    totale:  headers.findIndex(h => h === 'Totale'),
  }
  if (idx.numero < 0 || idx.totale < 0) return []
  return (data.slice(1) as unknown[][])
    .filter(row => row[idx.numero] && String(row[idx.numero]).trim())
    .map(row => ({
      numero:  String(row[idx.numero]).trim(),
      data:    String(row[idx.data]).trim(),
      cliente: String(row[idx.cliente]).trim(),
      totale:  parseImporto(row[idx.totale]),
    }))
}

function parseMovimenti(ws: XLSX.WorkSheet): Movimento[] {
  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  let headerIdx = -1
  for (let i = 0; i < data.length; i++) {
    if ((data[i] as unknown[]).some(c => String(c).trim() === 'Data operazione')) {
      headerIdx = i; break
    }
  }
  if (headerIdx < 0) return []
  const headers = (data[headerIdx] as string[]).map(h => String(h).trim())
  const idx = {
    dataOp:  headers.findIndex(h => h === 'Data operazione'),
    desc:    headers.findIndex(h => h === 'Descrizione'),
    entrate: headers.findIndex(h => h === 'Entrate'),
  }
  return (data.slice(headerIdx + 1) as unknown[][])
    .filter(row => row[idx.dataOp] && String(row[idx.dataOp]).trim())
    .map(row => ({
      dataOperazione: String(row[idx.dataOp]).trim(),
      descrizione:    String(row[idx.desc]).trim(),
      entrate:        parseImporto(row[idx.entrate]),
    }))
    .filter(m => m.entrate > 0)
}

// ─── Reconciliation ───────────────────────────────────────────────────────────

function matchInDescription(desc: string, numero: string): boolean {
  if (desc.toLowerCase().includes(numero.toLowerCase())) return true
  const base = numero.split('/')[0].replace(/^0+/, '') || numero
  return new RegExp(`\\b(n\\.?\\s*|ft\\.?\\s*|fat\\s+)0*${base}\\b`, 'i').test(desc)
}

function riconcilia(fatture: Fattura[], movimenti: Movimento[]): RigaRiconciliazione[] {
  const used = new Set<number>()
  return fatture.map(fattura => {
    let idx = movimenti.findIndex((m, i) =>
      !used.has(i) && matchInDescription(m.descrizione, fattura.numero)
    )
    if (idx >= 0) {
      used.add(idx)
      const mov = movimenti[idx]
      const diff = Math.round((mov.entrate - fattura.totale) * 100) / 100
      return { fattura, movimento: mov, tipoMatch: 'numero', differenza: diff,
               stato: Math.abs(diff) < 0.02 ? 'pagata' : 'importo_diverso' } as RigaRiconciliazione
    }
    idx = movimenti.findIndex((m, i) =>
      !used.has(i) && Math.abs(m.entrate - fattura.totale) < 0.02
    )
    if (idx >= 0) {
      used.add(idx)
      return { fattura, movimento: movimenti[idx], tipoMatch: 'importo', differenza: 0,
               stato: 'trovata_per_importo' } as RigaRiconciliazione
    }
    return { fattura, movimento: null, tipoMatch: null, differenza: fattura.totale,
             stato: 'non_pagata' } as RigaRiconciliazione
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEuro(n: number) {
  return n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
}

function StatoBadge({ stato }: { stato: StatoRiconciliazione }) {
  const map: Record<StatoRiconciliazione, { label: string; cls: string }> = {
    pagata:              { label: '✓ Pagata',          cls: 'bg-green-100 text-green-800 border-green-200' },
    importo_diverso:     { label: '⚠ Importo diverso', cls: 'bg-orange-100 text-orange-800 border-orange-200' },
    trovata_per_importo: { label: '~ Incerta',          cls: 'bg-blue-100 text-blue-800 border-blue-200' },
    non_pagata:          { label: '✗ Non pagata',       cls: 'bg-red-100 text-red-800 border-red-200' },
  }
  const { label, cls } = map[stato]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', cls)}>
      {label}
    </span>
  )
}

// ─── Upload zone ──────────────────────────────────────────────────────────────

function UploadZone({ label, description, accept, color, icon: Icon, file, retained, onFile, onClear, onClearRetained }: {
  label: string
  description: string
  accept: string
  color: string
  icon: React.ElementType
  file: File | null
  retained: ParsedDataset | null
  onFile: (f: File) => void
  onClear: () => void
  onClearRetained: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const hasData = !!retained

  return (
    <div
      className={cn(
        'border-2 rounded-xl p-5 transition-colors select-none',
        file
          ? 'border-solid border-green-500/60 bg-green-50 dark:bg-green-950/20'
          : hasData
          ? 'border-solid border-dashed border-primary/40 bg-primary/3 cursor-pointer hover:border-primary/60'
          : dragging
          ? 'border-primary bg-primary/5 cursor-copy'
          : 'border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-accent/30 cursor-pointer'
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragging(false)
        const f = e.dataTransfer.files[0]; if (f) onFile(f)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }}
      />
      <div className="flex flex-col items-center gap-2.5 text-center">
        {file ? (
          <>
            <CheckCircle2 className="h-9 w-9 text-green-500" />
            <div className="space-y-0.5">
              <p className="font-semibold text-sm text-green-700 dark:text-green-400">{label} caricato</p>
              <p className="text-xs text-muted-foreground break-all max-w-xs">{file.name}</p>
              {retained && (
                <p className="text-xs text-green-600">{retained.count} righe pronte</p>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <X className="h-3 w-3" /> Rimuovi
            </button>
          </>
        ) : hasData ? (
          <>
            <div className={cn('p-2.5 rounded-full opacity-60', color)}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">Ultimo: {retained!.filename}</p>
              <p className="text-xs font-medium text-primary">{retained!.count} righe disponibili</p>
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Upload className="h-3 w-3" />
                <span>Clicca per aggiornare</span>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClearRetained() }}
                className="flex items-center gap-1 text-xs text-destructive hover:underline"
              >
                <X className="h-3 w-3" /> Svuota
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={cn('p-2.5 rounded-full', color)}>
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Upload className="h-3.5 w-3.5" />
              <span>Clicca o trascina il file qui</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const LS_FATTURE   = 'pam_fp_fatture'
const LS_MOVIMENTI = 'pam_fp_movimenti'

// ─── Main ─────────────────────────────────────────────────────────────────────

export function FatturePagamentiClient() {
  const [fattureFile, setFattureFile]     = useState<File | null>(null)
  const [pagamentiFile, setPagamentiFile] = useState<File | null>(null)

  // Parsed datasets survive file removal and page reload (localStorage)
  const [parsedFatture,   setParsedFatture]   = useState<{ rows: Fattura[];   info: ParsedDataset } | null>(null)
  const [parsedMovimenti, setParsedMovimenti] = useState<{ rows: Movimento[]; info: ParsedDataset } | null>(null)

  const [righe,       setRighe]       = useState<RigaRiconciliazione[] | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [pdfLoading,  setPdfLoading]  = useState(false)
  const [syncing,     setSyncing]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [parseError,  setParseError]  = useState<{ fat?: string; pag?: string }>({})

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const f = localStorage.getItem(LS_FATTURE)
      if (f) setParsedFatture(JSON.parse(f))
      const m = localStorage.getItem(LS_MOVIMENTI)
      if (m) setParsedMovimenti(JSON.parse(m))
    } catch { /* ignore */ }
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    if (parsedFatture) localStorage.setItem(LS_FATTURE, JSON.stringify(parsedFatture))
    else localStorage.removeItem(LS_FATTURE)
  }, [parsedFatture])

  useEffect(() => {
    if (parsedMovimenti) localStorage.setItem(LS_MOVIMENTI, JSON.stringify(parsedMovimenti))
    else localStorage.removeItem(LS_MOVIMENTI)
  }, [parsedMovimenti])

  async function handleFattureFile(f: File) {
    setFattureFile(f)
    setRighe(null)
    setParseError(e => ({ ...e, fat: undefined }))
    try {
      const buf = await f.arrayBuffer()
      const wb  = XLSX.read(buf, { type: 'array' })
      const rows = parseFatture(wb.Sheets[wb.SheetNames[0]])
      if (!rows.length) throw new Error('Nessuna fattura trovata. Verifica intestazioni colonne.')
      setParsedFatture({ rows, info: { data: rows, filename: f.name, count: rows.length } })
    } catch (e) {
      setParseError(prev => ({ ...prev, fat: e instanceof Error ? e.message : 'Errore lettura file' }))
      setParsedFatture(null)
    }
  }

  async function handlePagamentiFile(f: File) {
    setPagamentiFile(f)
    setRighe(null)
    setParseError(e => ({ ...e, pag: undefined }))
    try {
      const buf = await f.arrayBuffer()
      const wb  = XLSX.read(buf, { type: 'array' })
      const rows = parseMovimenti(wb.Sheets[wb.SheetNames[0]])
      if (!rows.length) throw new Error('Nessun movimento trovato. Verifica intestazioni colonne.')
      setParsedMovimenti({ rows, info: { data: rows, filename: f.name, count: rows.length } })
    } catch (e) {
      setParseError(prev => ({ ...prev, pag: e instanceof Error ? e.message : 'Errore lettura file' }))
      setParsedMovimenti(null)
    }
  }

  async function syncFromContiBanca() {
    setPagamentiFile(null)
    setRighe(null)
    setParseError(e => ({ ...e, pag: undefined }))
    setSyncing(true)
    try {
      const res = await fetch('/api/conti-banca/movimenti-entrate')
      if (!res.ok) throw new Error('Errore nel recupero movimenti da Conti Banca')
      const rows: Movimento[] = await res.json()
      if (!rows.length) throw new Error('Nessun movimento (entrata) trovato in Conti Banca.')
      const now = new Date().toLocaleString('it-IT')
      setParsedMovimenti({ rows, info: { data: rows, filename: `Conti Banca — sincronizzato ${now}`, count: rows.length } })
      toast.success(`Sincronizzati ${rows.length} movimenti da Conti Banca`)
    } catch (e) {
      setParseError(prev => ({ ...prev, pag: e instanceof Error ? e.message : 'Errore sincronizzazione' }))
    } finally {
      setSyncing(false)
    }
  }

  function elabora() {
    if (!parsedFatture || !parsedMovimenti) return
    setLoading(true)
    setError(null)
    try {
      setRighe(riconcilia(parsedFatture.rows, parsedMovimenti.rows))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante la riconciliazione')
    } finally {
      setLoading(false)
    }
  }

  async function scaricaPdf() {
    if (!righe) return
    setPdfLoading(true)
    try {
      const [{ pdf }, { default: PdfRiconciliazione }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./PdfRiconciliazione'),
      ])
      const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const blob = await pdf(<PdfRiconciliazione righe={righe} generatoIl={oggi} />).toBlob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `riconciliazione-${oggi.replace(/\//g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore generazione PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  const canElabora   = !!parsedFatture && !!parsedMovimenti
  const canPdf       = !!righe && !pdfLoading

  const summary = righe ? {
    pagate:         righe.filter(r => r.stato === 'pagata').length,
    perImporto:     righe.filter(r => r.stato === 'trovata_per_importo').length,
    importoDiverso: righe.filter(r => r.stato === 'importo_diverso').length,
    nonPagate:      righe.filter(r => r.stato === 'non_pagata').length,
    totFatturato:   righe.reduce((s, r) => s + r.fattura.totale, 0),
    totIncassato:   righe.filter(r => r.movimento).reduce((s, r) => s + (r.movimento?.entrate ?? 0), 0),
    totNonPagato:   righe.filter(r => r.stato === 'non_pagata').reduce((s, r) => s + r.fattura.totale, 0),
  } : null

  return (
    <div className="space-y-6 max-w-5xl">
      <p className="text-sm text-muted-foreground">
        Carica le fatture emesse e i movimenti bancari per verificare quali fatture sono state pagate.
        I dati vengono memorizzati localmente: al prossimo accesso puoi riconciliare direttamente senza ricaricare i file.
      </p>

      {/* Upload zones */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <UploadZone
            label="Fatture"
            description="Elenco fatture emesse (XLSX)"
            accept=".xlsx,.xls,.csv"
            color="bg-blue-500"
            icon={FileText}
            file={fattureFile}
            retained={parsedFatture?.info ?? null}
            onFile={handleFattureFile}
            onClear={() => { setFattureFile(null); setRighe(null) }}
            onClearRetained={() => { setFattureFile(null); setParsedFatture(null); setRighe(null) }}
          />
          {parseError.fat && (
            <p className="text-xs text-destructive px-1">{parseError.fat}</p>
          )}
        </div>
        <div className="space-y-1">
          <UploadZone
            label="Movimenti bancari"
            description="Estratto conto movimenti (XLS/XLSX)"
            accept=".xlsx,.xls,.csv"
            color="bg-emerald-500"
            icon={CreditCard}
            file={pagamentiFile}
            retained={parsedMovimenti?.info ?? null}
            onFile={handlePagamentiFile}
            onClear={() => { setPagamentiFile(null); setRighe(null) }}
            onClearRetained={() => { setPagamentiFile(null); setParsedMovimenti(null); setRighe(null) }}
          />
          {parseError.pag && (
            <p className="text-xs text-destructive px-1">{parseError.pag}</p>
          )}
          <button
            type="button"
            onClick={syncFromContiBanca}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 px-1"
          >
            <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} />
            {syncing ? 'Sincronizzazione…' : 'Sincronizza da Conti Banca (entrate)'}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 items-center flex-wrap">
        <button
          onClick={elabora}
          disabled={!canElabora || loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
          {loading ? 'Elaborazione…' : 'Confronta e riconcilia'}
        </button>

        {canPdf && (
          <button
            onClick={scaricaPdf}
            disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors border"
          >
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {pdfLoading ? 'Generazione PDF…' : 'Scarica PDF'}
          </button>
        )}

        {righe && (
          <button
            onClick={() => setRighe(null)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Azzera risultati
          </button>
        )}
      </div>

      {!canElabora && (
        <p className="text-xs text-muted-foreground -mt-3">
          {!parsedFatture && !parsedMovimenti
            ? 'Carica entrambi i file per abilitare la riconciliazione.'
            : !parsedFatture
            ? 'Carica il file Fatture per abilitare la riconciliazione.'
            : 'Carica il file Movimenti per abilitare la riconciliazione.'}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results */}
      {righe && summary && (
        <div className="space-y-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Pagate',          value: summary.pagate,         cls: 'bg-green-50 dark:bg-green-950/20 text-green-700 border-green-200' },
              { label: 'Incerte',         value: summary.perImporto,     cls: 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 border-blue-200' },
              { label: 'Importo diverso', value: summary.importoDiverso, cls: 'bg-orange-50 dark:bg-orange-950/20 text-orange-700 border-orange-200' },
              { label: 'Non pagate',      value: summary.nonPagate,      cls: 'bg-red-50 dark:bg-red-950/20 text-red-700 border-red-200' },
            ].map(({ label, value, cls }) => (
              <div key={label} className={cn('rounded-lg border p-3 text-center', cls)}>
                <div className="text-2xl font-bold">{value}</div>
                <div className="text-xs mt-0.5 opacity-80">{label}</div>
              </div>
            ))}
          </div>

          {/* Amount summary */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Totale fatturato</div>
              <div className="font-semibold tabular-nums">{formatEuro(summary.totFatturato)}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Totale incassato</div>
              <div className="font-semibold text-green-700 tabular-nums">{formatEuro(summary.totIncassato)}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Da incassare</div>
              <div className={cn('font-semibold tabular-nums', summary.totNonPagato > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                {formatEuro(summary.totNonPagato)}
              </div>
            </div>
          </div>

          {/* Detail table */}
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">N° Fattura</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cliente</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Importo</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data pag.</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Ricevuto</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Stato</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((riga, i) => (
                  <tr
                    key={i}
                    className={cn(
                      'border-b last:border-0 transition-colors',
                      riga.stato === 'non_pagata'
                        ? 'bg-red-50/60 hover:bg-red-50 dark:bg-red-950/10'
                        : 'hover:bg-muted/30'
                    )}
                  >
                    <td className="px-3 py-2 font-mono text-xs font-semibold">{riga.fattura.numero}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{riga.fattura.data}</td>
                    <td className="px-3 py-2 max-w-[150px] truncate text-xs" title={riga.fattura.cliente}>{riga.fattura.cliente}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatEuro(riga.fattura.totale)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {riga.movimento?.dataOperazione ?? <span className="opacity-40">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-xs">
                      {riga.movimento ? (
                        <>
                          <span>{formatEuro(riga.movimento.entrate)}</span>
                          {riga.stato === 'importo_diverso' && (
                            <span className="block text-orange-600 text-[10px]">
                              diff. {riga.differenza > 0 ? '+' : ''}{formatEuro(riga.differenza)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="opacity-40">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatoBadge stato={riga.stato} />
                      {riga.tipoMatch === 'importo' && (
                        <span className="block text-[10px] text-muted-foreground mt-0.5">match per importo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Collapsible: bank descriptions */}
          {righe.some(r => r.movimento) && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                Mostra descrizioni bonifici
              </summary>
              <div className="mt-2 rounded-lg bg-muted/40 p-3 space-y-1.5 font-mono text-[10px] leading-relaxed">
                {righe.filter(r => r.movimento).map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="font-bold text-foreground shrink-0">{r.fattura.numero}:</span>
                    <span className="text-muted-foreground break-all">{r.movimento!.descrizione}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
