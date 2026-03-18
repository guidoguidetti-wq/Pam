// ============================================================
//  PAM — Tipi TypeScript condivisi
// ============================================================

// ─── ENUMS ──────────────────────────────────────────────────

export type TipoVoceListino = 'ORARIO' | 'GIORNALIERO' | 'KM' | 'RIMBORSO'
export type TipoBudget = 'STIMATO' | 'CONSUNTIVO'
export type TipoSpesa = 'KM' | 'AUTOSTRADA' | 'MEZZI' | 'VITTO' | 'ALLOGGIO' | 'ALTRO'

export const TIPI_ATTIVITA = [
  { codice: 'COM', descrizione: 'Commerciale' },
  { codice: 'PRE', descrizione: 'Presale' },
  { codice: 'PMG', descrizione: 'Project Management' },
  { codice: 'BAN', descrizione: 'Business Analyst' },
  { codice: 'SVI', descrizione: 'Sviluppo' },
  { codice: 'OPS', descrizione: 'Operation' },
] as const

export const TIPI_SPESA: { value: TipoSpesa; label: string }[] = [
  { value: 'KM',         label: 'Km percorsi' },
  { value: 'AUTOSTRADA', label: 'Autostrada' },
  { value: 'MEZZI',      label: 'Mezzi (treno/aereo/taxi)' },
  { value: 'VITTO',      label: 'Vitto' },
  { value: 'ALLOGGIO',   label: 'Alloggio' },
  { value: 'ALTRO',      label: 'Altro' },
]

// ─── HELPER ─────────────────────────────────────────────────

/** Converte minuti in stringa "X h YY m" */
export function formatOre(minuti: number): string {
  const h = Math.floor(minuti / 60)
  const m = minuti % 60
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')} m`
}

/** Formatta un importo in EUR */
export function formatValuta(importo: number | null | undefined, valuta = 'EUR'): string {
  if (importo == null) return '—'
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: valuta }).format(importo)
}

/** Calcola durata in minuti tra due stringhe "HH:MM" */
export function calcolaDurata(inizio: string, fine: string): number {
  const [hi, mi] = inizio.split(':').map(Number)
  const [hf, mf] = fine.split(':').map(Number)
  return (hf * 60 + mf) - (hi * 60 + mi)
}

/** Genera colore HSL deterministico per un committente */
export function coloreCommittente(id: number): string {
  return `hsl(${(id * 47) % 360}, 65%, 55%)`
}

// ─── TIPI API ────────────────────────────────────────────────

export interface CommittenteBase {
  id: number
  ragioneSociale: string
  attivo: boolean
}

export interface ClienteBase {
  id: number
  committenteId: number
  ragioneSociale: string
  attivo: boolean
}

export interface ProgettoBase {
  id: number
  committenteId: number
  clienteId: number
  nome: string
  codice: string | null
  tipoBudget: TipoBudget
  attivo: boolean
}

export interface AttivitaInput {
  dataAttivita: string          // ISO date 'YYYY-MM-DD'
  oraInizio: string             // 'HH:MM'
  oraFine: string               // 'HH:MM'
  committenteId: number
  clienteId: number
  progettoId?: number | null
  tipoAttivitaId: number
  descrizione?: string
  noteInterne?: string
  fatturabile: boolean
}

export interface SpesaInput {
  attivitaId: bigint
  tipoSpesa: TipoSpesa
  descrizione?: string
  quantita?: number             // per KM: numero chilometri
  importoUnitario?: number      // €/km (da listino o manuale)
  importoTotale: number
  dataSpesa: string             // ISO date
  rimborsoRichiesto: boolean
}

// ─── TIPI REPORT ─────────────────────────────────────────────

export interface RigaReport {
  tipoAttivitaCodice: string
  tipoAttivitaDescrizione: string
  minuti: number
  tariffaOraria: number | null
  tariffaGiornaliera: number | null
  orePerGiornata: number
  importoCompetenze: number | null
}

export interface RigaSpesaReport {
  tipoSpesa: TipoSpesa
  descrizione: string | null
  quantita: number | null
  importoUnitario: number | null
  importoTotale: number
  allegati: { storageUrl: string | null; nomeFile: string }[]
}

export interface SezioneProgettoReport {
  progettoNome: string
  progettoCodice: string | null
  tipoBudget: TipoBudget
  righe: RigaReport[]
  spese: RigaSpesaReport[]
  totaleCompetenze: number
  totaleSpese: number
}

export interface SezioneClienteReport {
  clienteRagioneSociale: string
  progetti: SezioneProgettoReport[]
  attivitaSenzaProgetto: RigaReport[]
  speseGeneriche: RigaSpesaReport[]
  totaleCompetenze: number
  totaleSpese: number
  totale: number
}

export interface ReportFatturazione {
  committente: CommittenteBase
  periodoInizio: string
  periodoFine: string
  clienti: SezioneClienteReport[]
  totaleCompetenze: number
  totaleSpese: number
  totale: number
  generatoIl: string
}

// ─── TIPI CALENDARIO ─────────────────────────────────────────

export interface EventoCalendario {
  id: string
  title: string
  start: string                 // ISO datetime
  end: string                   // ISO datetime
  backgroundColor: string
  borderColor: string
  extendedProps: {
    committenteId: number
    committenteNome: string
    clienteNome: string
    progettoNome?: string
    tipoAttivita: string
    durata: number              // minuti
    fatturabile: boolean
  }
}

export interface RiepilogoOre {
  giornata: number              // minuti totali nella data selezionata
  settimana: number             // minuti settimana corrente
  mese: number                  // minuti mese corrente
}
