'use client'

import dynamic from 'next/dynamic'

const CalendarioInterno = dynamic(() => import('./CalendarioInterno'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-muted-foreground">
      Caricamento calendario...
    </div>
  ),
})

interface Committente { id: number; ragioneSociale: string }
interface TipoAttivita { id: number; codice: string; descrizione: string; attivo: boolean }

interface CalendarioViewProps {
  committenti: Committente[]
  tipiAttivita: TipoAttivita[]
}

export default function CalendarioView({ committenti, tipiAttivita }: CalendarioViewProps) {
  return <CalendarioInterno committenti={committenti} tipiAttivita={tipiAttivita} />
}
