import { Modal, View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { formatarKg as formatarNumero } from '../helpers/numeros';
import BotaoModal from './BotaoModal';

// Com espaço comum, a quebra de linha pode deixar o "g" sozinho na linha de baixo
const ESPACO_NAO_SEPARAVEL = String.fromCharCode(160);

const emGramas = (valor) => `${formatarNumero(valor)}${ESPACO_NAO_SEPARAVEL}g`;

export default function ModalNovaCalibragem({ oferta, onUsar, onManter }) {
  if (!oferta) return null;
  const taraAtual = emGramas(oferta.atual.tara);
  const taraNova = emGramas(oferta.nova.tara);

  return (
    <Modal animationType="fade" transparent visible onRequestClose={onManter} statusBarTranslucent>
      <View style={styles.fundo}>
        <View style={styles.card}>
          <MaterialCommunityIcons name="scale" size={44} color="#1F6452" />
          <Text style={styles.titulo}>Nova calibragem</Text>
          <Text style={styles.texto}>
            Este projeto usa a tara de {taraAtual}. Existe uma calibragem mais nova, de {taraNova}.
          </Text>
          <BotaoModal
            icone="checkmark-circle" texto={`Usar ${taraNova}`} subtexto="As densidades já pesadas serão recalculadas"
            cor="#1F6452" onPress={onUsar}
          />
          <BotaoModal
            icone="close-circle" texto={`Manter ${taraAtual}`} subtexto="O projeto continua com a calibragem atual"
            cor="#787878" onPress={onManter}
          />
        </View>
      </View>
    </Modal>
  );
}

// TODO: extrair fundo, card, título e texto para um diálogo padrão em src/components, junto com o BotaoModal,
// e migrar o ModalProjetoEmAndamento e os modais antigos (centeredView/modalView) para ele
const styles = StyleSheet.create({
  fundo: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20,
  },
  card: {
    width: '100%', backgroundColor: '#FFF', borderRadius: 20,
    padding: 28, alignItems: 'center', elevation: 5,
  },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#000', textAlign: 'center', marginTop: 8 },
  texto: { fontSize: 18, color: '#333', textAlign: 'center', marginTop: 10, marginBottom: 12 },
});
