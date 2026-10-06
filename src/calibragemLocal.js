import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizarCalibragem, serializarCalibragem } from './helpers/calibragem';

const CHAVE_LEGADA = 'ultimaCalibragem';
const chaveCalibragem = (companyId) => `ultimaCalibragem:${companyId}`;

// A chave antiga não dizia de qual empresa era: fica com a primeira que ler, como já acontecia antes
async function migrarChaveLegada(companyId) {
  const legada = await AsyncStorage.getItem(CHAVE_LEGADA);
  if (!legada) return null;
  await AsyncStorage.setItem(chaveCalibragem(companyId), legada);
  await AsyncStorage.removeItem(CHAVE_LEGADA);
  return legada;
}

export async function lerCalibragemDoAparelho(companyId) {
  if (!companyId) return null;
  const salva = (await AsyncStorage.getItem(chaveCalibragem(companyId))) ?? (await migrarChaveLegada(companyId));
  return salva ? normalizarCalibragem(JSON.parse(salva)) : null;
}

export async function guardarCalibragemNoAparelho(companyId, calibragem) {
  if (!companyId) return;
  await AsyncStorage.setItem(chaveCalibragem(companyId), serializarCalibragem(calibragem));
}
