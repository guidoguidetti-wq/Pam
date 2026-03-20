import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer'
import React from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReportSpesa {
  tipoSpesa: string
  descrizione: string | null
  quantita: number | null
  importoUnitario: number | null
  importoTotale: number
  dataSpesa: string
  allegati: { storageUrl: string | null; nomeFile: string; tipoMime: string | null }[]
}

export interface ReportAttivita {
  dataAttivita: string
  oraInizio: string
  oraFine: string
  oreErogate: number // minuti
  tipoAttivita: string   // descrizione del tipo
  descrizione: string | null
  progetto: string | null
  prezzoUnitario: number | null
  valoreAttivita: number | null
  fatturabile: boolean
  hasSpese: boolean
  spese: ReportSpesa[]
}

export interface ReportCliente {
  id: number | null
  ragioneSociale: string
  attivita: ReportAttivita[]
}

export interface ReportCommittente {
  id: number
  ragioneSociale: string
  partitaIva: string | null
  indirizzo: string | null
  email: string | null
  telefono: string | null
  clienti: ReportCliente[]
}

export interface ReportDocumentProps {
  committenti: ReportCommittente[]
  from: string
  to: string
  includeSpese: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtData(s: string): string {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function fmtOre(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function fmtGiorni(mins: number): string {
  return `${(mins / (8 * 60)).toFixed(2)} gg`
}

function fmtEur(v: number | null): string {
  if (v == null) return '—'
  return `\u20AC ${v.toFixed(2)}`
}

function calcTotali(attivita: ReportAttivita[]) {
  let oreMin = 0, valFatt = 0, valNonFatt = 0
  for (const a of attivita) {
    oreMin += a.oreErogate
    if (a.fatturabile) valFatt += a.valoreAttivita ?? 0
    else valNonFatt += a.valoreAttivita ?? 0
  }
  return { oreMin, valFatt, valNonFatt }
}

const SPESA_LABELS: Record<string, string> = {
  KM: 'Km trasferta',
  AUTOSTRADA: 'Autostrada',
  MEZZI: 'Treni/Taxi/Aerei',
  VITTO: 'Vitto',
  ALLOGGIO: 'Alloggio',
  ALTRO: 'Altro',
}

// ── Palette ──────────────────────────────────────────────────────────────────

const PRIMARY   = '#1e3a5f'
const SECONDARY = '#4a7fb5'
const LIGHT     = '#eef3fb'
const BORDER    = '#d0d8e8'
const MUTED     = '#6b7280'
const GREEN     = '#16a34a'
const WHITE     = '#ffffff'

// ── Styles ───────────────────────────────────────────────────────────────────

// Activity table column widths (sum = 535 = A4 595 - 30*2 padding)
// Spese table column widths (sum = 535)

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#111827',
    paddingTop: 28,
    paddingBottom: 44,
    paddingHorizontal: 30,
  },
  // Committente
  committenteBlock: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: PRIMARY,
    borderBottomStyle: 'solid',
  },
  committenteName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: PRIMARY,
    marginBottom: 2,
  },
  committenteSub: { fontSize: 8, color: MUTED, marginTop: 1 },
  periodoBar: {
    backgroundColor: LIGHT,
    padding: 6,
    marginBottom: 10,
    borderRadius: 3,
  },
  periodoText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  // Cliente
  clienteHeader: {
    backgroundColor: PRIMARY,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 2,
    marginTop: 10,
  },
  clienteName: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: WHITE },
  // Attività table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: LIGHT,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: SECONDARY,
    borderBottomStyle: 'solid',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
    backgroundColor: '#f9fafb',
  },
  hdrText:   { fontSize: 7, fontFamily: 'Helvetica-Bold', color: PRIMARY, paddingHorizontal: 2 },
  cellText:  { fontSize: 7.5, paddingHorizontal: 2 },
  cellRight: { fontSize: 7.5, paddingHorizontal: 2, textAlign: 'right' },
  cellCenter:{ fontSize: 7.5, paddingHorizontal: 2, textAlign: 'center' },
  // Activity column widths (sum = 535)
  cData:     { width: 50 },
  cOrario:   { width: 62 },
  cDurata:   { width: 36 },
  cTipo:     { width: 85 },
  cProgetto: { width: 85 },
  cDesc:     { width: 85 },
  cTariffa:  { width: 48 },
  cValore:   { width: 56 },
  cF:        { width: 14 },
  cS:        { width: 14 },
  // Totali cliente
  totaliRow: {
    flexDirection: 'row',
    backgroundColor: LIGHT,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginTop: 3,
    justifyContent: 'space-between',
  },
  totaleItem:  { alignItems: 'flex-end' },
  totaleLbl:   { fontSize: 7, color: MUTED, marginBottom: 1 },
  totaleVal:   { fontSize: 9, fontFamily: 'Helvetica-Bold', color: PRIMARY },
  // Spese section
  speseSection: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
  },
  speseSectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: PRIMARY, marginBottom: 6 },
  speseTableHeader: {
    flexDirection: 'row',
    backgroundColor: LIGHT,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: SECONDARY,
    borderBottomStyle: 'solid',
  },
  speseTableRow: {
    flexDirection: 'row',
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
  },
  speseTableRowAlt: {
    flexDirection: 'row',
    paddingVertical: 2.5,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    borderBottomStyle: 'solid',
    backgroundColor: '#f9fafb',
  },
  // Spese column widths (sum = 535)
  sCData:    { width: 58 },
  sCTipo:    { width: 105 },
  sCDesc:    { width: 170 },
  sCQta:     { width: 58 },
  sCUnit:    { width: 64 },
  sCTotale:  { width: 80 },
  // Allegati
  allegatiSection:    { marginTop: 10 },
  allegatiTitle:      { fontSize: 8, fontFamily: 'Helvetica-Bold', color: MUTED, marginBottom: 6 },
  allegatiGrid:       { flexDirection: 'row', flexWrap: 'wrap' },
  allegatiItem:       { marginRight: 12, marginBottom: 12, width: 240 },
  allegatiImg:        { width: 240, height: 180 },
  allegatiCaption:    { fontSize: 7, color: MUTED, marginTop: 3 },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    borderTopStyle: 'solid',
    paddingTop: 4,
  },
  footerText: { fontSize: 7, color: MUTED },
})

// ── Sub-components ───────────────────────────────────────────────────────────

function AttivitaTable({ attivita }: { attivita: ReportAttivita[] }) {
  return (
    <View>
      <View style={S.tableHeader}>
        <Text style={[S.hdrText, S.cData]}>Data</Text>
        <Text style={[S.hdrText, S.cOrario]}>Orario</Text>
        <Text style={[S.hdrText, S.cDurata]}>Durata</Text>
        <Text style={[S.hdrText, S.cTipo]}>Tipo attivita</Text>
        <Text style={[S.hdrText, S.cProgetto]}>Progetto</Text>
        <Text style={[S.hdrText, S.cDesc]}>Descrizione</Text>
        <Text style={[S.hdrText, S.cTariffa, { textAlign: 'right' }]}>{'\u20AC'}/h</Text>
        <Text style={[S.hdrText, S.cValore, { textAlign: 'right' }]}>Valore</Text>
        <Text style={[S.hdrText, S.cF, { textAlign: 'center' }]}>F</Text>
        <Text style={[S.hdrText, S.cS, { textAlign: 'center' }]}>S</Text>
      </View>
      {attivita.map((a, i) => (
        <View key={i} style={i % 2 === 0 ? S.tableRow : S.tableRowAlt}>
          <Text style={[S.cellText, S.cData]}>{fmtData(a.dataAttivita)}</Text>
          <Text style={[S.cellText, S.cOrario]}>{a.oraInizio}–{a.oraFine}</Text>
          <Text style={[S.cellText, S.cDurata]}>{fmtOre(a.oreErogate)}</Text>
          <Text style={[S.cellText, S.cTipo]}>{a.tipoAttivita}</Text>
          <Text style={[S.cellText, S.cProgetto]}>{a.progetto ?? '—'}</Text>
          <Text style={[S.cellText, S.cDesc]}>{a.descrizione ?? '—'}</Text>
          <Text style={[S.cellRight, S.cTariffa]}>{fmtEur(a.prezzoUnitario)}</Text>
          <Text style={[S.cellRight, S.cValore]}>{fmtEur(a.valoreAttivita)}</Text>
          <Text style={[S.cellCenter, S.cF, { color: a.fatturabile ? GREEN : MUTED }]}>
            {a.fatturabile ? 'V' : '-'}
          </Text>
          <Text style={[S.cellCenter, S.cS, { color: a.hasSpese ? SECONDARY : MUTED }]}>
            {a.hasSpese ? 'V' : '-'}
          </Text>
        </View>
      ))}
    </View>
  )
}

function TotaliCliente({ attivita }: { attivita: ReportAttivita[] }) {
  const { oreMin, valFatt, valNonFatt } = calcTotali(attivita)
  return (
    <View style={S.totaliRow}>
      <View style={S.totaleItem}>
        <Text style={S.totaleLbl}>Ore totali</Text>
        <Text style={S.totaleVal}>{fmtOre(oreMin)}</Text>
      </View>
      <View style={S.totaleItem}>
        <Text style={S.totaleLbl}>Giorni (base 8h)</Text>
        <Text style={S.totaleVal}>{fmtGiorni(oreMin)}</Text>
      </View>
      <View style={S.totaleItem}>
        <Text style={S.totaleLbl}>Valore Attivita</Text>
        <Text style={[S.totaleVal, { color: GREEN }]}>{fmtEur(valFatt)}</Text>
      </View>
      <View style={S.totaleItem}>
        <Text style={S.totaleLbl}>Valore Non Fatturabile</Text>
        <Text style={[S.totaleVal, { color: MUTED }]}>{fmtEur(valNonFatt)}</Text>
      </View>
    </View>
  )
}

function SpeseSection({ clienti }: { clienti: ReportCliente[] }) {
  type SpesaExt = ReportSpesa & { clienteNome: string }
  type AllegatoExt = ReportSpesa['allegati'][0] & { clienteNome: string; dataSpesa: string }
  const allSpese: SpesaExt[] = []
  for (const cl of clienti) {
    for (const a of cl.attivita) {
      for (const s of a.spese) {
        allSpese.push({ ...s, clienteNome: cl.ragioneSociale })
      }
    }
  }
  if (allSpese.length === 0) return null

  const totale = allSpese.reduce((sum, s) => sum + s.importoTotale, 0)
  const allegatiImg: AllegatoExt[] = allSpese.flatMap(s =>
    s.allegati
      .filter(a => a.tipoMime?.startsWith('image/') && a.storageUrl)
      .map(a => ({ ...a, clienteNome: s.clienteNome, dataSpesa: s.dataSpesa }))
  )

  return (
    <View style={S.speseSection}>
      <Text style={S.speseSectionTitle}>Riepilogo Spese</Text>

      <View style={S.speseTableHeader}>
        <Text style={[S.hdrText, S.sCData]}>Data</Text>
        <Text style={[S.hdrText, S.sCTipo]}>Tipo</Text>
        <Text style={[S.hdrText, S.sCDesc]}>Descrizione / Cliente</Text>
        <Text style={[S.hdrText, S.sCQta, { textAlign: 'right' }]}>Qtà</Text>
        <Text style={[S.hdrText, S.sCUnit, { textAlign: 'right' }]}>{'\u20AC'}/u</Text>
        <Text style={[S.hdrText, S.sCTotale, { textAlign: 'right' }]}>Totale</Text>
      </View>

      {allSpese.map((s, i) => (
        <View key={i} style={i % 2 === 0 ? S.speseTableRow : S.speseTableRowAlt}>
          <Text style={[S.cellText, S.sCData]}>{fmtData(s.dataSpesa)}</Text>
          <Text style={[S.cellText, S.sCTipo]}>{SPESA_LABELS[s.tipoSpesa] ?? s.tipoSpesa}</Text>
          <Text style={[S.cellText, S.sCDesc]}>
            {[s.descrizione, s.clienteNome].filter(Boolean).join(' \u2014 ')}
          </Text>
          <Text style={[S.cellRight, S.sCQta]}>
            {s.quantita != null ? s.quantita.toFixed(0) : '\u2014'}
          </Text>
          <Text style={[S.cellRight, S.sCUnit]}>
            {s.importoUnitario != null ? fmtEur(s.importoUnitario) : '\u2014'}
          </Text>
          <Text style={[S.cellRight, S.sCTotale]}>{fmtEur(s.importoTotale)}</Text>
        </View>
      ))}

      <View style={[S.totaliRow, { marginTop: 4 }]}>
        <Text style={[S.totaleLbl, { flex: 1 }]}> </Text>
        <View style={S.totaleItem}>
          <Text style={S.totaleLbl}>Totale spese</Text>
          <Text style={S.totaleVal}>{fmtEur(totale)}</Text>
        </View>
      </View>

      {allegatiImg.length > 0 && (
        <View style={S.allegatiSection}>
          <Text style={S.allegatiTitle}>
            Allegati ({allegatiImg.length})
          </Text>
          <View style={S.allegatiGrid}>
            {allegatiImg.map((a, i) => (
              <View key={i} style={S.allegatiItem}>
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image src={a.storageUrl!} style={S.allegatiImg} />
                <Text style={S.allegatiCaption}>
                  {fmtData(a.dataSpesa)} - {a.clienteNome}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  )
}

// ── Main Document ────────────────────────────────────────────────────────────

export function ReportDocument({ committenti, from, to, includeSpese }: ReportDocumentProps) {
  const today = new Date()
  const generatedAt = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`

  return (
    <Document title="Report PAM" author="PAM - Personal Activity Manager">
      <Page size="A4" style={S.page}>
        {committenti.map((c, idx) => (
          <View key={c.id} break={idx > 0}>
            {/* Committente header */}
            <View style={S.committenteBlock}>
              <Text style={S.committenteName}>{c.ragioneSociale}</Text>
              {c.partitaIva && <Text style={S.committenteSub}>P.IVA: {c.partitaIva}</Text>}
              {c.indirizzo   && <Text style={S.committenteSub}>{c.indirizzo}</Text>}
              {(c.email || c.telefono) && (
                <Text style={S.committenteSub}>
                  {[c.email, c.telefono].filter(Boolean).join('   |   ')}
                </Text>
              )}
            </View>

            {/* Periodo */}
            <View style={S.periodoBar}>
              <Text style={S.periodoText}>
                Periodo: {fmtData(from)} – {fmtData(to)}
              </Text>
            </View>

            {/* Clienti */}
            {c.clienti.map(cliente => (
              <View key={String(cliente.id ?? 'no-cl')}>
                <View style={S.clienteHeader}>
                  <Text style={S.clienteName}>{cliente.ragioneSociale}</Text>
                </View>
                <AttivitaTable attivita={cliente.attivita} />
                <TotaliCliente attivita={cliente.attivita} />
              </View>
            ))}

            {/* Spese */}
            {includeSpese && <SpeseSection clienti={c.clienti} />}
          </View>
        ))}

        {/* Footer fisso su ogni pagina */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>PAM — Report generato il {generatedAt}</Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Pagina ${pageNumber} di ${totalPages}`
            }
            fixed
          />
        </View>
      </Page>
    </Document>
  )
}
