import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ModalGerarLicencas({ visible, onClose, onSave, onRenew, saving, companyName, licenseToRenew }) {
  const [qtd, setQtd] = useState('1');
  const [validade, setValidade] = useState(12);

  const isRenewMode = !!licenseToRenew;

  useEffect(() => {
    if (visible) {
      setQtd('1');
      setValidade(12);
    }
  }, [visible]);

  const handleSubmeter = () => {
    if (isRenewMode) {
      onRenew(licenseToRenew, validade);
      return;
    }

    const quantidade = parseInt(qtd, 10);
    if (isNaN(quantidade) || quantidade <= 0) {
      alert('Por favor, insira uma quantidade válida.');
      return;
    }
    if (quantidade > 100) {
      alert('O limite máximo de geração por lote é de 100 licenças.');
      return;
    }
    onSave(quantidade, validade);
  };

  const opcoes = [
    { label: '1 Min', value: '1min', isTest: true },
    { label: '1 Mês', value: 1 },
    { label: '6 Meses', value: 6 },
    { label: '1 Ano', value: 12 },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>

          <View style={styles.header}>
            <Text style={styles.titulo}>
              {isRenewMode ? 'Renovar Licença' : 'Gerar Licenças em Lote'}
            </Text>
            <TouchableOpacity onPress={onClose} disabled={saving}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          {isRenewMode ? (
            <>
              <Text style={styles.subtitulo}>
                Empresa: <Text style={{ fontWeight: '700' }}>{companyName}</Text>
              </Text>
              <View style={styles.keyBox}>
                <Ionicons name="key-outline" size={14} color="#888" />
                <Text style={styles.keyText} numberOfLines={1}>{licenseToRenew.key}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.subtitulo}>
              Empresa: <Text style={{ fontWeight: '700' }}>{companyName}</Text>
            </Text>
          )}

          {!isRenewMode && (
            <>
              <Text style={styles.label}>Quantidade (Máx. 100)</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={qtd}
                onChangeText={setQtd}
                editable={!saving}
                maxLength={3}
              />
            </>
          )}

          <Text style={styles.label}>
            {isRenewMode ? 'Nova Validade' : 'Validade do Plano'}
          </Text>
          <View style={styles.gridValidade}>
            {opcoes.map((opcao) => {
              const ativo = validade === opcao.value;
              return (
                <TouchableOpacity
                  key={String(opcao.value)}
                  style={[
                    styles.btnValidade,
                    ativo && (opcao.isTest ? styles.btnValidadeAtivoTeste : styles.btnValidadeAtivo),
                    opcao.isTest && styles.btnTeste,
                  ]}
                  onPress={() => setValidade(opcao.value)}
                  disabled={saving}
                >
                  {opcao.isTest && (
                    <Text style={[styles.badgeTeste, ativo && styles.badgeTesteAtivo]}>TESTE</Text>
                  )}
                  <Text style={[
                    styles.txtValidade,
                    ativo && (opcao.isTest ? styles.txtValidadeAtivoTeste : styles.txtValidadeAtivo),
                  ]}>
                    {opcao.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.btnCancelar} onPress={onClose} disabled={saving}>
              <Text style={styles.txtCancelar}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnConfirmar, saving && { opacity: 0.6 }]}
              onPress={handleSubmeter}
              disabled={saving}
            >
              <Text style={styles.txtConfirmar}>
                {saving
                  ? (isRenewMode ? 'Renovando...' : 'Gerando...')
                  : (isRenewMode ? 'Renovar Licença' : `Gerar ${qtd} Licença(s)`)}
              </Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  content: { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  titulo: { fontSize: 18, fontWeight: '800', color: '#222' },
  subtitulo: { fontSize: 14, color: '#666', marginBottom: 20 },
  keyBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f4f4f4', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 20 },
  keyText: { fontSize: 12, fontFamily: 'monospace', color: '#444', flex: 1 },
  label: { fontSize: 13, fontWeight: '700', color: '#444', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#222', marginBottom: 20 },
  gridValidade: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  btnValidade: { flex: 1, minWidth: '45%', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingVertical: 12, alignItems: 'center', backgroundColor: '#f9f9f9' },
  btnTeste: { borderStyle: 'dashed', borderColor: '#aaa' },
  btnValidadeAtivo: { borderColor: '#E75F07', backgroundColor: '#fcf8f5' },
  btnValidadeAtivoTeste: { borderColor: '#7C3AED', backgroundColor: '#f5f3ff', borderStyle: 'dashed' },
  txtValidade: { fontSize: 13, fontWeight: '600', color: '#555' },
  txtValidadeAtivo: { color: '#E75F07', fontWeight: '700' },
  txtValidadeAtivoTeste: { color: '#7C3AED', fontWeight: '700' },
  badgeTeste: { fontSize: 9, fontWeight: '800', color: '#aaa', letterSpacing: 0.5, marginBottom: 2 },
  badgeTesteAtivo: { color: '#7C3AED' },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  btnCancelar: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  txtCancelar: { color: '#777', fontWeight: '600' },
  btnConfirmar: { backgroundColor: '#E75F07', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  txtConfirmar: { color: '#fff', fontWeight: '700' },
});
