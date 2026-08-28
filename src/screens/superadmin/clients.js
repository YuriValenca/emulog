import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCNPJ } from '../../helpers/formatCNPJ';

export default function AbaClientes({
  companies,
  clients,
  filteredFilterId,
  onSetFilterId,
  onAddPress,
  onEditPress,
  onDeletePress,
  onToggleAtivo,
  formatDate,
}) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedCompany = companies.find(c => c.id === filteredFilterId);
  const allowedCompanies = companies.filter(company => company.name !== 'Explog');

  const filteredClients = filteredFilterId
    ? clients.filter(c => c.companyId === filteredFilterId)
    : [];

  const handleSelectCompany = (companyId) => {
    onSetFilterId(companyId);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.secaoHeader}>
        <Text style={styles.secaoTitulo}>Clientes</Text>
        {filteredFilterId && (
          <TouchableOpacity style={styles.addBtn} onPress={onAddPress} activeOpacity={0.8}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnTexto}>Novo</Text>
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
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#555" />
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.dropdownMenu}>
            <ScrollView nestedScrollEnabled={true} style={styles.dropdownScroll}>
              {allowedCompanies.map(c => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.dropdownItem, filteredFilterId === c.id && styles.dropdownItemAtivo]}
                  onPress={() => handleSelectCompany(c.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dropdownItemTexto, filteredFilterId === c.id && styles.dropdownItemTextoAtivo]}>
                    {c.name}
                  </Text>
                  {filteredFilterId === c.id && (
                    <Ionicons name="checkmark" size={18} color="#1F6452" />
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
          <Text style={styles.vazioText}>Selecione uma empresa para ver os clientes.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.resumo}>
            {filteredClients.length} cliente(s) encontrado(s)
          </Text>

          {filteredClients.map(c => (
            <View key={c.id} style={styles.card}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => onEditPress(c)} activeOpacity={0.8}>
                <Text style={styles.cardNome}>{c.nome}</Text>
                <Text style={styles.cardSub}>{c.cnpj ? formatCNPJ(c.cnpj) : 'CNPJ não informado'}</Text>
                {c.endereco && <Text style={styles.cardMeta}>{c.endereco}</Text>}
                <Text style={styles.cardMeta}>Cadastrado em: {formatDate(c.criadoEm)}</Text>
              </TouchableOpacity>

              <View style={styles.cardActions}>
                <Switch
                  value={!!c.ativo}
                  onValueChange={() => onToggleAtivo(c)}
                  trackColor={{ false: '#e0e0e0', true: '#a5d6a7' }}
                  thumbColor={c.ativo ? '#4CAF50' : '#bbb'}
                />
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => onDeletePress(c)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={20} color="#D32F2F" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {filteredClients.length === 0 && (
            <Text style={styles.vazioText}>Nenhum cliente cadastrado para esta empresa.</Text>
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
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#1F6452', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnTexto: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dropdownWrapper: { zIndex: 10, position: 'relative', marginBottom: 16 },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#fff' },
  dropdownHeaderText: { fontSize: 14, color: '#222', fontWeight: '600' },
  dropdownPlaceholder: { color: '#999', fontWeight: '400' },
  dropdownMenu: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, maxHeight: 200, zIndex: 99 },
  dropdownScroll: { paddingVertical: 4 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  dropdownItemAtivo: { backgroundColor: '#E3F0EC' },
  dropdownItemTexto: { fontSize: 14, color: '#444' },
  dropdownItemTextoAtivo: { color: '#1F6452', fontWeight: '700' },
  resumo: { fontSize: 12, color: '#aaa', marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#efefef' },
  cardNome: { fontSize: 15, fontWeight: '700', color: '#222', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#777' },
  cardMeta: { fontSize: 11, color: '#aaa', marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginLeft: 10 },
  actionBtn: { padding: 6 },
  vazioContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  vazioText: { color: '#aaa', fontStyle: 'italic', textAlign: 'center' },
});
