'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Bell, Loader2, Mic, MicOff, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface Reminder {
  id: number
  testo: string
  createdAt: string
}

const schema = z.object({
  testo: z.string().trim().min(1, 'Scrivi qualcosa da ricordare').max(5000),
})
type FormValues = z.infer<typeof schema>

// Web Speech API: non tipizzata in lib.dom, la descriviamo al minimo indispensabile
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export default function RemindersWidget() {
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { testo: '' } })

  useEffect(() => {
    setSpeechSupported(getSpeechRecognition() !== null)
    fetch('/api/reminder')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then(setReminders)
      .catch(() => toast.error('Errore nel caricamento dei reminder'))
      .finally(() => setLoading(false))
    return () => recognitionRef.current?.stop()
  }, [])

  function stopListening() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  function startListening() {
    const SR = getSpeechRecognition()
    if (!SR) return
    const rec = new SR()
    rec.lang = 'it-IT'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e) => {
      let finale = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finale += e.results[i][0].transcript
      }
      if (!finale.trim()) return
      const attuale = form.getValues('testo')
      form.setValue('testo', (attuale ? attuale.trimEnd() + ' ' : '') + finale.trim(), { shouldValidate: true })
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast.error('Permesso microfono negato')
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast.error(`Errore riconoscimento vocale: ${e.error}`)
      }
    }
    rec.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }

  function chiudiForm() {
    stopListening()
    form.reset()
    setAdding(false)
  }

  async function onSubmit(values: FormValues) {
    stopListening()
    const res = await fetch('/api/reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    if (!res.ok) {
      toast.error('Errore nel salvataggio del reminder')
      return
    }
    const nuovo: Reminder = await res.json()
    setReminders((r) => [nuovo, ...r])
    toast.success('Reminder aggiunto')
    form.reset()
    setAdding(false)
  }

  async function elimina(id: number) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/reminder/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setReminders((r) => r.filter((x) => x.id !== id))
      toast.success('Reminder eliminato')
    } catch {
      toast.error("Errore nell'eliminazione del reminder")
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-amber-50 dark:bg-amber-950/20">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-amber-700 dark:text-amber-400">Reminders</h2>
          {reminders.length > 0 && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full font-medium">
              {reminders.length}
            </span>
          )}
        </div>
        {!adding && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Nuovo
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={form.handleSubmit(onSubmit)} className="p-3 border-b space-y-2">
          <Textarea
            {...form.register('testo')}
            autoFocus
            rows={2}
            placeholder={speechSupported ? 'Scrivi o detta la nota da ricordare…' : 'Scrivi la nota da ricordare…'}
            className="text-sm resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) form.handleSubmit(onSubmit)()
              if (e.key === 'Escape') chiudiForm()
            }}
          />
          {form.formState.errors.testo && (
            <p className="text-xs text-red-600">{form.formState.errors.testo.message}</p>
          )}
          <div className="flex items-center justify-between gap-2">
            {speechSupported ? (
              <Button
                type="button"
                size="sm"
                variant={listening ? 'destructive' : 'outline'}
                className={cn('h-8 gap-1.5', listening && 'animate-pulse')}
                onClick={listening ? stopListening : startListening}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {listening ? 'Stop' : 'Detta'}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="ghost" className="h-8" onClick={chiudiForm}>
                <X className="h-4 w-4" />
              </Button>
              <Button type="submit" size="sm" className="h-8" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salva
              </Button>
            </div>
          </div>
        </form>
      )}

      <div className="divide-y max-h-[140px] overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : reminders.length === 0 ? (
          <p className="px-4 py-4 text-xs text-muted-foreground text-center">Nessun reminder</p>
        ) : (
          reminders.map((r) => (
            <div key={r.id} className="group px-4 py-2 flex items-start gap-3">
              <p className="flex-1 min-w-0 text-sm whitespace-pre-wrap break-words">{r.testo}</p>
              <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5 tabular-nums">
                {new Date(r.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-600"
                onClick={() => elimina(r.id)}
                disabled={deletingId === r.id}
                title="Elimina"
              >
                {deletingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
