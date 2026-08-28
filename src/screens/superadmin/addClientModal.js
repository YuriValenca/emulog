import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCNPJ, isValidCNPJ } from '../../helpers/formatCNPJ';

export default function ModalCliente({ visible, onClose, onSave, saving, companyName, clientToEdit }) {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [endereco, setEndereco] = useState('');

  const isEditing = !!clientToEdit;

  useEffect(() => {
    if (visible) {
      setNome(clientToEdit?.nome || '');
      setCnpj(clientToEdit?.cnpj || '');
      setEndereco(clientToEdit?.endereco || '');
    }
  }, [visible, clientToEdit]);

  const handleSubmeter = () => {
    if (!nome.trim()) {
      alert('Por favor, informe o nome do cliente.');
      return;
    }
    if (!cnpj) {
      onSave({ nome, endereco })
      return;
    }
    if (!isValidCNPJ(cnpj)) {
      alert('CNPJ incorreto ou em formato inválido.');
      return;
    }
    onSave({ nome, cnpj, endereco });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.flexDismiss} activeOpacity={1} onPress={onClose} disabled={saving} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheet}
        >
          <View style={styles.indicator} />

          <View style={styles.header}>
            <Text style={styles.titulo}>{isEditing ? 'Editar Cliente' : 'Novo Cliente'}</Text>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitulo}>
            Empresa: <Text style={{ fontWeight: '700' }}>{companyName}</Text>
          </Text>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <Text style={styles.label}>Nome</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Razão social ou nome do cliente"
              placeholderTextColor="#888888"
              editable={!saving}
            />

            <Text style={styles.label}>CNPJ (opcional)</Text>
            <TextInput
              style={styles.input}
              value={formatCNPJ(cnpj)}
              onChangeText={setCnpj}
              placeholder="00.000.000/0000-00"
              placeholderTextColor="#888888"
              editable={!saving}
            />

            <Text style={styles.label}>Endereço (opcional)</Text>
            <TextInput
              style={styles.input}
              value={endereco}
              onChangeText={setEndereco}
              placeholder="Endereço completo"
              placeholderTextColor="#888888"
              editable={!saving}
            />

            <View style={{ height: 24 }} />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnCancelar} onPress={onClose} disabled={saving}>
              <Text style={styles.txtCancelar}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnConfirmar, saving && styles.btnConfirmarDisabled]}
              onPress={handleSubmeter}
              disabled={saving}
            >
              <Text style={styles.txtConfirmar}>
                {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Cliente'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  flexDismiss: { flex: 1 },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 64,
    maxHeight: '90%',
  },
  indicator: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titulo: { fontSize: 18, fontWeight: '800', color: '#222' },
  subtitulo: { fontSize: 14, color: '#666', marginBottom: 20 },
  formScroll: { flexGrow: 0 },
  formContent: { paddingBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#eee',
  },
  btnCancelar: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  txtCancelar: { color: '#777', fontWeight: '600' },
  btnConfirmar: {
    backgroundColor: '#1F6452',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  btnConfirmarDisabled: { opacity: 0.6 },
  txtConfirmar: { color: '#fff', fontWeight: '700' },
});
