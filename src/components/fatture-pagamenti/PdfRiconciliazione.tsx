import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

// Types duplicated here to avoid importing from client component
export interface FatturaPdf {
  numero: string
  data: string
  cliente: string
  totale: number
}
export interface MovimentoPdf {
  dataOperazione: string
  entrate: number
}
export type StatoPdf = 'pagata' | 'importo_diverso' | 'trovata_per_importo' | 'non_pagata'
export interface RigaPdf {
  fattura: FatturaPdf
  movimento: MovimentoPdf | null
  tipoMatch: 'numero' | 'importo' | null
  differenza: number
  stato: StatoPdf
}

const fmt = (n: number) =>
  n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

const statoLabel: Record<StatoPdf, string> = {
  pagata:              'Pagata',
  importo_diverso:     'Importo diverso',
  trovata_per_importo: 'Incerta',
  non_pagata:          'Non pagata',
}
const statoColor: Record<StatoPdf, string> = {
  pagata:              '#16a34a',
  importo_diverso:     '#ea580c',
  trovata_per_importo: '#2563eb',
  non_pagata:          '#dc2626',
}

const s = StyleSheet.create({
  page:      { padding: 28, fontFamily: 'Helvetica', fontSize: 8 },
  title:     { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  subtitle:  { fontSize: 8, color: '#6b7280', marginBottom: 14 },
  section:   { marginBottom: 12 },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 5, color: '#374151' },
  kpiRow:    { flexDirection: 'row', gap: 8, marginBottom: 6 },
  kpi:       { flex: 1, padding: 6, borderRadius: 4, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  kpiNum:    { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  kpiLabel:  { fontSize: 7, color: '#6b7280' },
  amtRow:    { flexDirection: 'row', gap: 8, marginBottom: 14 },
  amtBox:    { flex: 1, padding: 6, borderRadius: 4, borderWidth: 1, borderColor: '#e5e7eb' },
  amtLabel:  { fontSize: 7, color: '#6b7280', marginBottom: 2 },
  amtValue:  { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  thead:     { flexDirection: 'row', backgroundColor: '#f3f4f6', borderTopLeftRadius: 3, borderTopRightRadius: 3, paddingVertical: 4, paddingHorizontal: 3 },
  th:        { fontFamily: 'Helvetica-Bold', fontSize: 7, color: '#374151' },
  row:       { flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 3, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  td:        { fontSize: 7, color: '#111827' },
  badge:     { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 8, fontSize: 6, fontFamily: 'Helvetica-Bold' },
})

const COL = { num: '8%', data: '10%', cliente: '24%', imp: '11%', dataPag: '10%', ric: '11%', stato: '14%' }

export default function PdfRiconciliazione({
  righe,
  generatoIl,
}: {
  righe: RigaPdf[]
  generatoIl: string
}) {
  const pagate          = righe.filter(r => r.stato === 'pagata').length
  const incerte         = righe.filter(r => r.stato === 'trovata_per_importo').length
  const importoDiverso  = righe.filter(r => r.stato === 'importo_diverso').length
  const nonPagate       = righe.filter(r => r.stato === 'non_pagata').length
  const totFatturato    = righe.reduce((s, r) => s + r.fattura.totale, 0)
  const totIncassato    = righe.filter(r => r.movimento).reduce((s, r) => s + (r.movimento?.entrate ?? 0), 0)
  const totNonPagato    = righe.filter(r => r.stato === 'non_pagata').reduce((s, r) => s + r.fattura.totale, 0)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.title}>Riconciliazione Fatture / Pagamenti</Text>
        <Text style={s.subtitle}>Generato il {generatoIl} — {righe.length} fatture analizzate</Text>

        {/* KPIs */}
        <View style={s.kpiRow}>
          {[
            { label: 'Pagate',          value: pagate,         color: '#16a34a' },
            { label: 'Incerte',         value: incerte,        color: '#2563eb' },
            { label: 'Importo diverso', value: importoDiverso, color: '#ea580c' },
            { label: 'Non pagate',      value: nonPagate,      color: '#dc2626' },
          ].map(({ label, value, color }) => (
            <View key={label} style={s.kpi}>
              <Text style={[s.kpiNum, { color }]}>{value}</Text>
              <Text style={s.kpiLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Amounts */}
        <View style={s.amtRow}>
          {[
            { label: 'Totale fatturato', value: fmt(totFatturato), color: '#111827' },
            { label: 'Totale incassato', value: fmt(totIncassato), color: '#16a34a' },
            { label: 'Da incassare',     value: fmt(totNonPagato), color: nonPagate > 0 ? '#dc2626' : '#6b7280' },
          ].map(({ label, value, color }) => (
            <View key={label} style={s.amtBox}>
              <Text style={s.amtLabel}>{label}</Text>
              <Text style={[s.amtValue, { color }]}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Table header */}
        <View style={s.thead}>
          <Text style={[s.th, { width: COL.num }]}>N° Fattura</Text>
          <Text style={[s.th, { width: COL.data }]}>Data</Text>
          <Text style={[s.th, { width: COL.cliente }]}>Cliente</Text>
          <Text style={[s.th, { width: COL.imp, textAlign: 'right' }]}>Importo</Text>
          <Text style={[s.th, { width: COL.dataPag }]}>Data pag.</Text>
          <Text style={[s.th, { width: COL.ric, textAlign: 'right' }]}>Ricevuto</Text>
          <Text style={[s.th, { width: COL.stato }]}>Stato</Text>
        </View>

        {/* Rows */}
        {righe.map((r, i) => (
          <View
            key={i}
            style={[s.row, r.stato === 'non_pagata' ? { backgroundColor: '#fff5f5' } : i % 2 === 0 ? {} : { backgroundColor: '#fafafa' }]}
          >
            <Text style={[s.td, { width: COL.num, fontFamily: 'Helvetica-Bold' }]}>{r.fattura.numero}</Text>
            <Text style={[s.td, { width: COL.data, color: '#6b7280' }]}>{r.fattura.data}</Text>
            <Text style={[s.td, { width: COL.cliente }]}>{r.fattura.cliente.length > 28 ? r.fattura.cliente.slice(0, 26) + '…' : r.fattura.cliente}</Text>
            <Text style={[s.td, { width: COL.imp, textAlign: 'right', fontFamily: 'Helvetica-Bold' }]}>{fmt(r.fattura.totale)}</Text>
            <Text style={[s.td, { width: COL.dataPag, color: '#6b7280' }]}>{r.movimento?.dataOperazione ?? '—'}</Text>
            <View style={{ width: COL.ric, alignItems: 'flex-end' }}>
              <Text style={[s.td, { textAlign: 'right' }]}>{r.movimento ? fmt(r.movimento.entrate) : '—'}</Text>
              {r.stato === 'importo_diverso' && (
                <Text style={{ fontSize: 6, color: '#ea580c' }}>
                  diff. {r.differenza > 0 ? '+' : ''}{fmt(r.differenza)}
                </Text>
              )}
            </View>
            <View style={{ width: COL.stato }}>
              <Text style={[s.badge, { color: statoColor[r.stato], backgroundColor: statoColor[r.stato] + '20' }]}>
                {statoLabel[r.stato]}
              </Text>
              {r.tipoMatch === 'importo' && (
                <Text style={{ fontSize: 5.5, color: '#6b7280', marginTop: 1 }}>match per importo</Text>
              )}
            </View>
          </View>
        ))}
      </Page>
    </Document>
  )
}
