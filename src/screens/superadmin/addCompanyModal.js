import React, { useEffect, useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, TextInput, Switch, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ColorPicker from 'react-native-wheel-color-picker';

export default function ModalEmpresa({ visible, onClose, onSave, saving, companyToEdit }) {
  const [form, setForm] = useState({
    name: '', cnpj: '', logo: '', primaryColor: '#FF9621', active: false,
  });

  useEffect(() => {
    if (companyToEdit) {
      setForm({
        name: companyToEdit.name || '',
        cnpj: companyToEdit.cnpj || '',
        logo: companyToEdit.logo || '',
        primaryColor: companyToEdit.primaryColor || '#FF9621',
        active: !!companyToEdit.active,
      });
    } else {
      setForm({ name: '', cnpj: '', logo: '', primaryColor: '#FF9621', active: false });
    }
  }, [companyToEdit, visible]);

  const handleCnpjChange = (text) => {
    const raw = text.replace(/\D/g, '');
    let masked = '';

    if (raw.length <= 2) {
      masked = raw;
    } else if (raw.length <= 5) {
      masked = `${raw.slice(0, 2)}.${raw.slice(2)}`;
    } else if (raw.length <= 8) {
      masked = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
    } else if (raw.length <= 12) {
      masked = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`;
    } else {
      masked = `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12, 14)}`;
    }
    setForm(p => ({ ...p, cnpj: masked }));
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitulo}>{companyToEdit ? 'Editar Empresa' : 'Nova Empresa'}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.formLabel}>Nome *</Text>
            <TextInput style={styles.formInput} value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="Razão social" />

            <Text style={styles.formLabel}>CNPJ</Text>
            <TextInput style={styles.formInput} value={form.cnpj} onChangeText={handleCnpjChange} placeholder="00.000.000/0000-00" keyboardType="numeric" maxLength={18} />

            <Text style={styles.formLabel}>URL da Logo</Text>
            <TextInput style={styles.formInput} value={form.logo} onChangeText={v => setForm(p => ({ ...p, logo: v }))} placeholder="https://exemplo.com/logo.png" />

            <Text style={styles.formLabel}>Cor Principal</Text>
            <View style={styles.pickerWrapper}>
              <ColorPicker
                color={form.primaryColor}
                onColorChangeComplete={v => setForm(p => ({ ...p, primaryColor: v }))}
                thumbSize={24}
                sliderSize={20}
                noSnap
                row
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.formLabel}>Empresa Ativa</Text>
              <Switch
                value={form.active}
                onValueChange={v => setForm(p => ({ ...p, active: v }))}
                trackColor={{ false: '#e0e0e0', true: '#a5d6a7' }}
                thumbColor={form.active ? '#4CAF50' : '#bbb'}
              />
            </View>
          </ScrollView>

          <TouchableOpacity style={[styles.modalBtn, saving && styles.modalBtnDisabled]} onPress={() => onSave(form)} disabled={saving} activeOpacity={0.8}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={20} color="#fff" />}
            <Text style={styles.modalBtnTexto}>{saving ? 'Salvando...' : companyToEdit ? 'Salvar Alterações' : 'Criar Empresa'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitulo: { fontSize: 17, fontWeight: '700', color: '#222' },
  scroll: { marginBottom: 16 },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  formInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 16, backgroundColor: '#fafafa' },
  pickerWrapper: { height: 200, marginBottom: 24, paddingHorizontal: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E75F07', borderRadius: 10, padding: 14, marginTop: 8 },
  modalBtnDisabled: { backgroundColor: '#f0a07a' },
  modalBtnTexto: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
