import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function StatusBadge({ status }) {
  const map = {
    available: { label: 'Disponível', bg: '#e8f5e9', color: '#2e7d32' },
    active:    { label: 'Ativa',      bg: '#e3f2fd', color: '#1565c0' },
    revoked:   { label: 'Revogada',   bg: '#fce4ec', color: '#c62828' },
    expired:   { label: 'Expirada',   bg: '#fff3e0', color: '#e65100' },
  };
  const cfg = map[status] || { label: status, bg: '#f5f5f5', color: '#555' };
  return (
    <View style={[badgeStyles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[badgeStyles.label, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  label: { fontSize: 12, fontWeight: '700' },
});

export default function AbaLicencas({ 
  companies, 
  licenses, 
  filteredFilterId, 
  onSetFilterId, 
  onGeneratePress, 
  onRevokePress, 
  onRemovePress, 
  formatDate 
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedCompany = companies.find(c => c.id === filteredFilterId);
  const allowedCompanies = companies.filter(company => company.name !== 'Explog');
  
  const filteredLicenses = filteredFilterId
    ? licenses.filter(l => l.companyId === filteredFilterId)
    : [];

  const handleSelectCompany = (companyId) => {
    onSetFilterId(companyId);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.secaoHeader}>
        <Text style={styles.secaoTitulo}>Licenças</Text>
        {filteredFilterId && (
          <TouchableOpacity style={styles.addBtn} onPress={onGeneratePress} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnTexto}>Gerar</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dropdownWrapper}>
        <TouchableOpacity 
          style={styles.dropdownHeader} 
          onPress={() => setIsOpen(!isOpen)}
          activeOpacity={0.9}
        >
          <Text style={[styles.dropdownHeaderText, !selectedCompany && styles.dropdownPlaceholder]}>
            {selectedCompany ? selectedCompany.name : 'Selecione uma empresa...'}
          </Text>
          <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color="#555" />
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.dropdownMenu}>
            <ScrollView nestedScrollEnabled={true} style={styles.dropdownScroll}>
              {allowedCompanies.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[
                    styles.dropdownItem, 
                    filteredFilterId === c.id && styles.dropdownItemAtivo
                  ]}
                  onPress={() => handleSelectCompany(c.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dropdownItemTexto, 
                    filteredFilterId === c.id && styles.dropdownItemTextoAtivo
                  ]}>
                    {c.name}
                  </Text>
                  {filteredFilterId === c.id && (
                    <Ionicons name="checkmark" size={18} color="#E75F07" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {!filteredFilterId ? (
        <View style={styles.vazioContainer}>
          <Ionicons name="business-outline" size={48} color="#ccc" style={{ marginBottom: 8 }} />
          <Text style={styles.vazioText}>Selecione uma empresa para ver as licenças.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.resumo}>
            {filteredLicenses.length} licença(s) encontrada(s)
          </Text>

          {filteredLicenses.map(l => (
            <View key={l.id} style={styles.card}>
              <View style={{ flex: 1 }}>
                <Text style={styles.licenseKey}>{l.key}</Text>
                <View style={styles.licenseMetaRow}>
                  <StatusBadge status={l.status} />
                  <Text style={styles.cardMeta}> Expira: {formatDate(l.expiresAt)}</Text>
                </View>
                {l.deviceId && (
                  <Text style={styles.cardSub} numberOfLines={1}>Device: {l.deviceId}</Text>
                )}
              </View>

              {l.status !== 'revoked' && l.status !== 'expired' ? (
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => onRevokePress(l)} 
                  activeOpacity={0.8}
                >
                  <Ionicons name="close-circle-outline" size={22} color="#f44336" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.actionBtn} 
                  onPress={() => onRemovePress(l)} 
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={20} color="#777" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {filteredLicenses.length === 0 && (
            <Text style={styles.vazioText}>Nenhuma licença cadastrada para esta empresa.</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  secaoTitulo: { fontSize: 16, fontWeight: '700', color: '#222' },
  secaoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, minHeight: 40 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E75F07', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dropdownWrapper: { zIndex: 10, position: 'relative', marginBottom: 16 },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff' },
  dropdownHeaderText: { fontSize: 14, color: '#222', fontWeight: '600' },
  dropdownPlaceholder: { color: '#999', fontWeight: '400' },
  dropdownMenu: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, maxHeight: 200, zIndex: 99 },
  dropdownScroll: { paddingVertical: 4 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  dropdownItemAtivo: { backgroundColor: '#fcf8f5' },
  dropdownItemTexto: { fontSize: 14, color: '#444' },
  dropdownItemTextoAtivo: { color: '#E75F07', fontWeight: '700' },
  resumo: { fontSize: 12, color: '#aaa', marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#efefef' },
  licenseKey: { fontSize: 12, fontWeight: '700', color: '#333', fontFamily: 'monospace', marginBottom: 6 },
  licenseMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  cardMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  cardSub: { fontSize: 12, color: '#777' },
  actionBtn: { padding: 6 },
  vazioContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  vazioText: { color: '#aaa', fontStyle: 'italic', textAlign: 'center' },
});
