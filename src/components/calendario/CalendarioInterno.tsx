'use client'

import { useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventClickArg, EventSourceFuncArg } from '@fullcalendar/core'
import itLocale from '@fullcalendar/core/locales/it'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AttivitaForm } from '@/components/attivita/AttivitaForm'

interface Committente { id: number; ragioneSociale: string }
interface TipoAttivita { id: number; codice: string; descrizione: string; attivo: boolean }

interface CalendarioInternoProps {
  committenti: Committente[]
  tipiAttivita: TipoAttivita[]
}

interface DefaultSlot {
  dataAttivita: string
  oraInizio: string
  oraFine: string
}

function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function CalendarioInterno({ committenti, tipiAttivita }: CalendarioInternoProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editId, setEditId] = useState<string | undefined>(undefined)
  const [defaultSlot, setDefaultSlot] = useState<DefaultSlot | undefined>(undefined)

  async function fetchEvents(info: EventSourceFuncArg) {
    const from = info.startStr.split('T')[0]
    const to = info.endStr.split('T')[0]
    const res = await fetch(`/api/attivita?from=${from}&to=${to}`)
    if (!res.ok) return []
    return res.json()
  }

  function handleSelect(arg: DateSelectArg) {
    const data = arg.startStr.split('T')[0]
    const oraInizio = toHHMM(arg.start)
    const oraFine = toHHMM(arg.end)
    setEditId(undefined)
    setDefaultSlot({ dataAttivita: data, oraInizio, oraFine })
    setSheetOpen(true)
  }

  function handleEventClick(arg: EventClickArg) {
    setDefaultSlot(undefined)
    setEditId(arg.event.id)
    setSheetOpen(true)
  }

  function refetch() {
    calendarRef.current?.getApi().refetchEvents()
  }

  function onSaved() {
    setSheetOpen(false)
    refetch()
  }

  function onDeleted() {
    setSheetOpen(false)
    refetch()
  }

  return (
    <div className="h-[calc(100vh-4rem)] p-2">
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={itLocale}
        slotMinTime="06:00:00"
        slotMaxTime="20:00:00"
        allDaySlot={false}
        nowIndicator={true}
        selectable={true}
        selectMirror={true}
        height="100%"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridWeek,timeGridDay',
        }}
        events={fetchEvents}
        select={handleSelect}
        eventClick={handleEventClick}
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false }}
      />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editId ? 'Modifica attività' : 'Nuova attività'}</SheetTitle>
          </SheetHeader>
          <div className="mt-2">
            {sheetOpen && (
              <AttivitaForm
                committenti={committenti}
                tipiAttivita={tipiAttivita.filter((t) => t.attivo)}
                eventId={editId}
                defaultSlot={defaultSlot}
                onSaved={onSaved}
                onDeleted={onDeleted}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
