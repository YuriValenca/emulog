import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ModalAdicionarUsuario({ visible, onClose, onSave, saving, companies, defaultCompanyId }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [empresaId, setEmpresaId] = useState('');
  const [isDropOpen, setIsDropOpen] = useState(false);

  useEffect(() => {
    if (visible) {
      setNome('');
      setEmail('');
      setSenha('');
      setEmpresaId(defaultCompanyId || '');
      setIsDropOpen(false);
    }
  }, [visible, defaultCompanyId]);

  const handleSubmeter = () => {
    if (!nome.trim() || !email.trim() || !senha.trim() || !empresaId) {
      alert('Por favor, preencha todos os campos e selecione uma empresa.');
      return;
    }
    onSave({
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      senha: senha,
      companyId: empresaId,
    });
  };

  const empresaSelecionada = companies.find(c => c.id === empresaId);

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
            <Text style={styles.titulo}>Adicionar Novo Usuário</Text>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <Text style={styles.label}>Nome Completo</Text>
            <TextInput
              style={styles.input}
              value={nome}
              onChangeText={setNome}
              placeholder="Ex: João Silva"
              editable={!saving}
            />

            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="exemplo@xplog.com"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!saving}
            />

            <Text style={styles.label}>Senha Inicial</Text>
            <TextInput
              style={styles.input}
              value={senha}
              onChangeText={setSenha}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              editable={!saving}
            />

            <Text style={styles.label}>Empresa Vinculada</Text>
            <TouchableOpacity
              style={[styles.dropdownHeader, isDropOpen && styles.dropdownHeaderAberto]}
              onPress={() => setIsDropOpen(v => !v)}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownText, !empresaId && styles.dropdownPlaceholder]}>
                {empresaSelecionada ? empresaSelecionada.name : 'Selecione a organização...'}
              </Text>
              <Ionicons name={isDropOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#555" />
            </TouchableOpacity>

            {isDropOpen && (
              <View style={styles.dropdownList}>
                {companies.map((c, index) => {
                  const selecionado = empresaId === c.id;
                  const ultimo = index === companies.length - 1;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.dropdownItem,
                        selecionado && styles.dropdownItemAtivo,
                        ultimo && styles.dropdownItemUltimo,
                      ]}
                      onPress={() => { setEmpresaId(c.id); setIsDropOpen(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dropdownItemText, selecionado && styles.dropdownItemTextAtivo]}>
                        {c.name}
                      </Text>
                      {selecionado && <Ionicons name="checkmark" size={18} color="#E75F07" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

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
                {saving ? 'Adicionando...' : 'Cadastrar Usuário'}
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
    paddingBottom: 30,
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
    marginBottom: 20,
  },
  titulo: { fontSize: 18, fontWeight: '800', color: '#222' },
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
    color: '#222',
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fafafa',
  },
  dropdownHeaderAberto: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomColor: 'transparent',
  },
  dropdownText: { fontSize: 14, color: '#222' },
  dropdownPlaceholder: { color: '#999' },
  dropdownList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#ccc',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 16,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#eee',
  },
  dropdownItemUltimo: { borderBottomWidth: 0 },
  dropdownItemAtivo: { backgroundColor: '#FFF5EE' },
  dropdownItemText: { fontSize: 14, color: '#444' },
  dropdownItemTextAtivo: { color: '#E75F07', fontWeight: '600' },
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
    backgroundColor: '#E75F07',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  btnConfirmarDisabled: { opacity: 0.6 },
  txtConfirmar: { color: '#fff', fontWeight: '700' },
});
