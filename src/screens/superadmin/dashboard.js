import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function StatCard({ icon, label, value, sub, color }) {
  return (
    <View style={[statStyles.card, { borderTopColor: color }]}>
      <Ionicons name={icon} size={22} color={color} style={{ marginBottom: 6 }} />
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
      {sub ? <Text style={statStyles.sub}>{sub}</Text> : null}
    </View>
  );
}

export default function AbaDashboard({ stats, companies, licenses }) {
  return (
    <View>
      <Text style={styles.secaoTitulo}>Visão Geral</Text>
      <View style={styles.statsGrid}>
        <StatCard icon="business" label="Empresas" value={stats.totalCompanies} sub={`${stats.activeCompanies} ativas`} color="#1A73E8" />
        <StatCard icon="people" label="Usuários" value={stats.totalUsers} color="#9C27B0" />
        <StatCard icon="key" label="Licenças" value={stats.totalLicenses} sub={`${stats.activeLicenses} ativas`} color="#4CAF50" />
        <StatCard icon="time" label="Expira em 30d" value={stats.expiringSoon} color="#FF9621" />
        <StatCard icon="layers" label="Disponíveis" value={stats.availableLicenses} sub="não alocadas" color="#00BCD4" />
      </View>

      <Text style={styles.secaoTitulo}>Empresas Recentes</Text>
      {companies.map(c => (
        <View key={c.id} style={styles.card}>
          <View style={[styles.cardDot, { backgroundColor: (c.active || c.founding) ? '#4CAF50' : '#ccc' }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardNome}>{c.name}</Text>
            <Text style={styles.cardSub}>{c.cnpj || 'CNPJ não informado'}</Text>
            {c.founding && <Text style={styles.foundingTag}>✦ Founding</Text>}
          </View>
          <Text style={styles.cardMeta}>
            {licenses.filter(l => l.companyId === c.id && l.status === 'active').length} ativas /&nbsp;
            {licenses.filter(l => l.companyId === c.id).length} total
          </Text>
        </View>
      ))}
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, borderTopWidth: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  value: { fontSize: 28, fontWeight: '800', color: '#222', lineHeight: 32 },
  label: { fontSize: 13, color: '#555', fontWeight: '600', marginTop: 2 },
  sub: { fontSize: 11, color: '#aaa', marginTop: 2 },
});

const styles = StyleSheet.create({
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: '#222', marginBottom: 12, marginTop: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#efefef', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  cardDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  cardNome: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#777' },
  cardMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  foundingTag: { fontSize: 11, color: '#E75F07', fontWeight: '700', marginTop: 2 },
});
