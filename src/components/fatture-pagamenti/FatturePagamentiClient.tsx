'use client'

import { useRef, useState } from 'react'
import { FileText, CreditCard, Upload, X, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileState {
  file: File | null
  dragging: boolean
}

function UploadZone({
  label,
  description,
  accept,
  icon: Icon,
  color,
  state,
  onFile,
  onClear,
}: {
  label: string
  description: string
  accept: string
  icon: React.ElementType
  color: string
  state: FileState
  onFile: (f: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) onFile(f)
    e.target.value = ''
  }

  return (
    <div
      className={cn(
        'border-2 rounded-xl p-6 transition-colors cursor-pointer select-none',
        state.dragging ? 'border-primary bg-primary/5' : 'border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-accent/30',
        state.file && 'border-solid border-green-500/60 bg-green-50 dark:bg-green-950/20'
      )}
      onClick={() => !state.file && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault() }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />

      <div className="flex flex-col items-center gap-3 text-center">
        {state.file ? (
          <>
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <div className="space-y-1">
              <p className="font-semibold text-sm text-green-700 dark:text-green-400">{label} caricato</p>
              <p className="text-xs text-muted-foreground break-all max-w-xs">{state.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(state.file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="flex items-center gap-1 text-xs text-destructive hover:underline"
            >
              <X className="h-3 w-3" />
              Rimuovi
            </button>
          </>
        ) : (
          <>
            <div className={cn('p-3 rounded-full', color)}>
              <Icon className="h-7 w-7 text-white" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Upload className="h-3.5 w-3.5" />
              <span>Clicca o trascina il file qui</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function FatturePagamentiClient() {
  const [fatture, setFatture] = useState<FileState>({ file: null, dragging: false })
  const [pagamenti, setPagamenti] = useState<FileState>({ file: null, dragging: false })

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">
        Carica i file esportati dal portale delle fatture elettroniche e dal sito della banca per l&apos;analisi e la riconciliazione.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <UploadZone
          label="Fatture"
          description="Esportazione dal portale fatture elettroniche"
          accept=".xml,.zip,.csv,.xlsx,.xls,.json"
          icon={FileText}
          color="bg-blue-500"
          state={fatture}
          onFile={(f) => setFatture({ file: f, dragging: false })}
          onClear={() => setFatture({ file: null, dragging: false })}
        />

        <UploadZone
          label="Pagamenti"
          description="Esportazione movimenti bancari"
          accept=".csv,.xlsx,.xls,.xml,.json,.ofx,.qif"
          icon={CreditCard}
          color="bg-emerald-500"
          state={pagamenti}
          onFile={(f) => setPagamenti({ file: f, dragging: false })}
          onClear={() => setPagamenti({ file: null, dragging: false })}
        />
      </div>

      {(fatture.file || pagamenti.file) && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
          <p className="font-medium">File pronti:</p>
          {fatture.file && (
            <p className="text-muted-foreground">
              <span className="font-medium text-blue-600">Fatture:</span> {fatture.file.name}
            </p>
          )}
          {pagamenti.file && (
            <p className="text-muted-foreground">
              <span className="font-medium text-emerald-600">Pagamenti:</span> {pagamenti.file.name}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
