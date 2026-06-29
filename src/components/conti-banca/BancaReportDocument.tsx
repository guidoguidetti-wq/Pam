import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { fontSize: 8, fontFamily: 'Helvetica', padding: 30, color: '#111' },
  header: { marginBottom: 12 },
  title: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#555', marginBottom: 2 },
  sectionHeader: {
    backgroundColor: '#1e40af', color: '#fff', fontFamily: 'Helvetica-Bold',
    fontSize: 9, padding: '4 6', marginTop: 10, marginBottom: 2,
  },
  table: { width: '100%' },
  tableHead: {
    flexDirection: 'row', backgroundColor: '#e2e8f0',
    fontFamily: 'Helvetica-Bold', fontSize: 7, padding: '3 4',
  },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', padding: '2 4' },
  tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#e2e8f0', padding: '2 4', backgroundColor: '#f8fafc' },
  colData: { width: '10%' },
  colEnte: { width: '20%' },
  colDesc: { width: '52%' },
  colImporto: { width: '18%', textAlign: 'right' },
  totRow: {
    flexDirection: 'row', marginTop: 4, padding: '4 4',
    backgroundColor: '#1e40af', color: '#fff', fontFamily: 'Helvetica-Bold', fontSize: 8,
  },
  footer: { marginTop: 16, fontSize: 7, color: '#888', textAlign: 'center' },
  positive: { color: '#15803d' },
  negative: { color: '#dc2626' },
})

type Movimento = {
  id: number
  dataOperazione: string
  ente: string
  descrizione: string
  importo: number
  categoria: string
  banca: string
  numeroConto: string
}

type Props = {
  movimenti: Movimento[]
  conti: string[]
  da: string
  a: string
  ordinamento: string
}

function fmt(d: string) {
  const [y, m, g] = d.split('-')
  return `${g}/${m}/${y}`
}

function fmtEur(n: number) {
  const abs = Math.abs(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return (n >= 0 ? '+ ' : '- ') + '€ ' + abs
}

function truncate(s: string, len: number) {
  return s.length > len ? s.substring(0, len) + '…' : s
}

export function BancaReportDocument({ movimenti, conti, da, a, ordinamento }: Props) {
  const totEntrate = movimenti.filter(m => m.importo > 0).reduce((s, m) => s + m.importo, 0)
  const totUscite = movimenti.filter(m => m.importo < 0).reduce((s, m) => s + m.importo, 0)
  const saldo = totEntrate + totUscite

  // Group by ente when ordinamento === 'ente'
  const groups: { label: string; rows: Movimento[] }[] =
    ordinamento === 'ente'
      ? Object.entries(
          movimenti.reduce<Record<string, Movimento[]>>((acc, m) => {
            const k = m.ente
            ;(acc[k] ??= []).push(m)
            return acc
          }, {})
        )
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([label, rows]) => ({ label, rows: rows.sort((a, b) => b.dataOperazione.localeCompare(a.dataOperazione)) }))
      : [{ label: '', rows: movimenti }]

  return (
    <Document title={`Movimenti bancari ${fmt(da)} – ${fmt(a)}`}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Movimenti Bancari</Text>
          <Text style={styles.subtitle}>Periodo: {fmt(da)} – {fmt(a)}</Text>
          {conti.map((c, i) => <Text key={i} style={styles.subtitle}>Conto: {c}</Text>)}
          <Text style={styles.subtitle}>Ordinamento: {ordinamento === 'ente' ? 'per Ente e Data' : 'per Data'}</Text>
        </View>

        {groups.map((group, gi) => (
          <View key={gi}>
            {group.label && (
              <Text style={styles.sectionHeader}>{group.label}</Text>
            )}
            <View style={styles.table}>
              <View style={styles.tableHead}>
                <Text style={styles.colData}>Data Op.</Text>
                <Text style={styles.colEnte}>Ente</Text>
                <Text style={styles.colDesc}>Descrizione</Text>
                <Text style={styles.colImporto}>Importo</Text>
              </View>
              {group.rows.map((m, i) => (
                <View key={m.id} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={styles.colData}>{fmt(m.dataOperazione)}</Text>
                  <Text style={styles.colEnte}>{truncate(m.ente, 28)}</Text>
                  <Text style={styles.colDesc}>{truncate(m.descrizione, 90)}</Text>
                  <Text style={[styles.colImporto, m.importo >= 0 ? styles.positive : styles.negative]}>
                    {fmtEur(m.importo)}
                  </Text>
                </View>
              ))}
              {group.label && (() => {
                const subTot = group.rows.reduce((s, r) => s + r.importo, 0)
                return (
                  <View style={styles.totRow}>
                    <Text style={[styles.colData, { width: '82%' }]}>Subtotale {group.label}</Text>
                    <Text style={styles.colImporto}>{fmtEur(subTot)}</Text>
                  </View>
                )
              })()}
            </View>
          </View>
        ))}

        <View style={[styles.totRow, { marginTop: 12 }]}>
          <Text style={{ width: '30%' }}>TOTALE ENTRATE</Text>
          <Text style={{ width: '20%', textAlign: 'right' }}>{fmtEur(totEntrate)}</Text>
          <Text style={{ width: '30%', textAlign: 'center' }}>TOTALE USCITE</Text>
          <Text style={{ width: '20%', textAlign: 'right' }}>{fmtEur(totUscite)}</Text>
        </View>
        <View style={[styles.totRow, { backgroundColor: '#0f172a', marginTop: 2 }]}>
          <Text style={{ width: '80%' }}>SALDO PERIODO</Text>
          <Text style={{ width: '20%', textAlign: 'right' }}>{fmtEur(saldo)}</Text>
        </View>

        <Text style={styles.footer}>
          Generato il {new Date().toLocaleDateString('it-IT')} — PAM Personal Activity Manager
        </Text>
      </Page>
    </Document>
  )
}
