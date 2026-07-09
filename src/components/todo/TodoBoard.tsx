'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, Calendar, Building2, User, ChevronDown, Archive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import TodoDialog, { type TodoItem } from './TodoDialog'

interface Committente {
  id: number
  ragioneSociale: string
}

interface Cliente {
  id: number
  ragioneSociale: string
  committenteId: number
}

interface Props {
  committenti: Committente[]
  clienti: Cliente[]
}

const STATI = [
  { key: 'APERTA', label: 'Evidenza', color: 'border-blue-400 bg-blue-50 dark:bg-blue-950/30', headerColor: 'bg-blue-400 text-white' },
  { key: 'IN_CORSO', label: 'Aperta', color: 'border-amber-400 bg-amber-50 dark:bg-amber-950/30', headerColor: 'bg-amber-400 text-white' },
  { key: 'IN_ATTESA', label: 'In attesa', color: 'border-purple-400 bg-purple-50 dark:bg-purple-950/30', headerColor: 'bg-purple-400 text-white' },
  { key: 'CHIUSA', label: 'Chiusa', color: 'border-slate-300 bg-slate-50 dark:bg-slate-900/30', headerColor: 'bg-slate-400 text-white' },
] as const

// Colonne visualizzate nella board: lo stato Chiusa non occupa spazio in pagina,
// è raggiungibile solo dal pulsante dedicato nell'header
const STATI_BOARD = STATI.filter((s) => s.key !== 'CHIUSA')

const PRIORITA_CONFIG = {
  URGENTE: { label: 'Urgente', dot: 'bg-red-500', border: 'border-l-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  ALTA:    { label: 'Alta',    dot: 'bg-orange-400', border: 'border-l-orange-400', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  MEDIA:   { label: 'Media',   dot: 'bg-blue-400', border: 'border-l-blue-400', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  BASSA:   { label: 'Bassa',   dot: 'bg-slate-400', border: 'border-l-slate-400', badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
}

function isScaduta(scadenza: string | null) {
  if (!scadenza) return false
  return new Date(scadenza + 'T00:00:00') < new Date(new Date().toDateString())
}

function formatScadenza(scadenza: string | null) {
  if (!scadenza) return null
  return new Date(scadenza + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

function getCommittenteName(todo: TodoItem) {
  return todo.committente?.ragioneSociale ?? todo.committenteLibero ?? null
}

function getClienteName(todo: TodoItem) {
  return todo.cliente?.ragioneSociale ?? todo.clienteLibero ?? null
}

function TodoCard({
  todo,
  onEdit,
  onDelete,
  onChangeStato,
}: {
  todo: TodoItem
  onEdit: () => void
  onDelete: () => void
  onChangeStato: (stato: TodoItem['stato']) => void
}) {
  const [showStatoMenu, setShowStatoMenu] = useState(false)
  const cfg = PRIORITA_CONFIG[todo.priorita]
  const scaduta = isScaduta(todo.scadenza)
  const committente = getCommittenteName(todo)
  const cliente = getClienteName(todo)

  return (
    <div
      className={cn(
        'relative rounded-md border border-l-4 bg-card shadow-sm p-1.5 space-y-1 group',
        cfg.border
      )}
    >
      {/* Header: priorità badge + azioni */}
      <div className="flex items-start justify-between gap-1">
        <span className={cn('text-[9px] font-semibold px-1 py-0.5 rounded shrink-0', cfg.badge)}>
          <span className={cn('inline-block h-1.5 w-1.5 rounded-full mr-1 align-middle', cfg.dot)} />
          {cfg.label}
        </span>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Titolo */}
      <p className={cn('text-xs font-medium leading-snug line-clamp-2', todo.stato === 'CHIUSA' && 'line-through text-muted-foreground')}>
        {todo.titolo}
      </p>

      {/* Meta info */}
      {(committente || todo.scadenza) && (
        <div className="space-y-0.5">
          {committente && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Building2 className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{committente}</span>
              {cliente && (
                <>
                  <span className="text-muted-foreground/50">›</span>
                  <User className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{cliente}</span>
                </>
              )}
            </div>
          )}
          {todo.scadenza && (
            <div className={cn('flex items-center gap-1 text-[10px]', scaduta ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
              <Calendar className="h-2.5 w-2.5 shrink-0" />
              <span>{formatScadenza(todo.scadenza)}{scaduta ? ' — scaduta!' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Cambio stato rapido */}
      <div className="relative">
        <button
          onClick={() => setShowStatoMenu((v) => !v)}
          className="flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Sposta in <ChevronDown className="h-2.5 w-2.5" />
        </button>
        {showStatoMenu && (
          <div className="absolute bottom-full left-0 mb-1 z-20 bg-card border rounded-lg shadow-lg py-1 min-w-[130px]">
            {STATI.filter((s) => s.key !== todo.stato).map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  onChangeStato(s.key as TodoItem['stato'])
                  setShowStatoMenu(false)
                }}
                className="block w-full text-left text-xs px-3 py-1.5 hover:bg-accent"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TodoBoard({ committenti, clienti }: Props) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTodo, setEditingTodo] = useState<TodoItem | null>(null)
  const [activeTab, setActiveTab] = useState<string>('APERTA')
  const [chiuseOpen, setChiuseOpen] = useState(false)

  const fetchTodos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/todo')
      if (res.ok) setTodos(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTodos() }, [fetchTodos])

  function handleSaved(saved: TodoItem) {
    setTodos((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]
    })
  }

  async function handleDelete(todo: TodoItem) {
    if (!confirm(`Eliminare il task "${todo.titolo}"?`)) return
    try {
      const res = await fetch(`/api/todo/${todo.id}`, { method: 'DELETE' })
      if (res.ok) {
        setTodos((prev) => prev.filter((t) => t.id !== todo.id))
        toast.success('Task eliminato')
      }
    } catch {
      toast.error('Errore eliminazione')
    }
  }

  async function handleChangeStato(todo: TodoItem, stato: TodoItem['stato']) {
    try {
      const res = await fetch(`/api/todo/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stato }),
      })
      if (res.ok) {
        const updated: TodoItem = await res.json()
        handleSaved(updated)
        toast.success('Stato aggiornato')
      }
    } catch {
      toast.error('Errore aggiornamento')
    }
  }

  const byStato = (stato: string) => todos.filter((t) => t.stato === stato)
  const chiuse = byStato('CHIUSA')

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Task & Memo</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setChiuseOpen(true)}>
            <Archive className="h-4 w-4 mr-1" />
            Chiuse
            {chiuse.length > 0 && (
              <span className="ml-1.5 text-[10px] font-bold bg-muted rounded-full px-1.5 py-0.5">{chiuse.length}</span>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingTodo(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nuovo task
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* Board desktop (3 colonne) */}
          <div className="hidden md:grid grid-cols-3 gap-2 items-start">
            {STATI_BOARD.map((stato) => {
              const items = byStato(stato.key)
              return (
                <div key={stato.key} className={cn('rounded-xl border-2 overflow-hidden', stato.color)}>
                  <div className={cn('px-2 py-1.5 flex items-center justify-between', stato.headerColor)}>
                    <span className="text-sm font-semibold">{stato.label}</span>
                    <span className="text-xs font-bold bg-white/20 rounded-full px-2 py-0.5">{items.length}</span>
                  </div>
                  <div className="p-1.5 space-y-1.5 min-h-[80px] max-h-[calc(100vh-220px)] overflow-y-auto">
                    {items.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-4">Nessun task</p>
                    ) : (
                      items.map((todo) => (
                        <TodoCard
                          key={todo.id}
                          todo={todo}
                          onEdit={() => {
                            setEditingTodo(todo)
                            setDialogOpen(true)
                          }}
                          onDelete={() => handleDelete(todo)}
                          onChangeStato={(s) => handleChangeStato(todo, s)}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Board mobile (tabs) */}
          <div className="md:hidden space-y-3">
            {/* Tab bar */}
            <div className="flex rounded-lg border overflow-hidden">
              {STATI_BOARD.map((stato) => {
                const count = byStato(stato.key).length
                return (
                  <button
                    key={stato.key}
                    onClick={() => setActiveTab(stato.key)}
                    className={cn(
                      'flex-1 py-2 text-xs font-medium transition-colors relative',
                      activeTab === stato.key ? stato.headerColor : 'bg-muted/50 text-muted-foreground'
                    )}
                  >
                    {stato.label}
                    {count > 0 && (
                      <span className={cn(
                        'ml-1 text-[10px] font-bold px-1 rounded',
                        activeTab === stato.key ? 'bg-white/20' : 'bg-muted'
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Colonna attiva */}
            {(() => {
              const items = byStato(activeTab)
              return (
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">Nessun task</p>
                  ) : (
                    items.map((todo) => (
                      <TodoCard
                        key={todo.id}
                        todo={todo}
                        onEdit={() => {
                          setEditingTodo(todo)
                          setDialogOpen(true)
                        }}
                        onDelete={() => handleDelete(todo)}
                        onChangeStato={(s) => handleChangeStato(todo, s)}
                      />
                    ))
                  )}
                </div>
              )
            })()}
          </div>
        </>
      )}

      <TodoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        todo={editingTodo}
        committenti={committenti}
        clienti={clienti}
        onSaved={handleSaved}
      />

      {/* Task chiusi */}
      <Dialog open={chiuseOpen} onOpenChange={setChiuseOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Task chiusi ({chiuse.length})</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            {chiuse.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nessun task chiuso</p>
            ) : (
              chiuse.map((todo) => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  onEdit={() => {
                    setEditingTodo(todo)
                    setDialogOpen(true)
                  }}
                  onDelete={() => handleDelete(todo)}
                  onChangeStato={(s) => handleChangeStato(todo, s)}
                />
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
