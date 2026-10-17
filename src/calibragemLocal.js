import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizarCalibragem, serializarCalibragem, calibragemMaisRecente } from './helpers/calibragem';

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

// A do aparelho pode ser mais nova que a do banco quando foi feita offline e ainda não sincronizou
export async function adotarCalibragemDoBanco(companyId, doBanco) {
  const maisRecente = calibragemMaisRecente(doBanco, await lerCalibragemDoAparelho(companyId));
  if (maisRecente) await guardarCalibragemNoAparelho(companyId, maisRecente);
  return maisRecente;
}
