import AsyncStorage from '@react-native-async-storage/async-storage';

export async function lerJson(chave, padrao) {
  const salvo = await AsyncStorage.getItem(chave);
  return salvo ? JSON.parse(salvo) : padrao;
}

export const gravarJson = (chave, valor) => AsyncStorage.setItem(chave, JSON.stringify(valor));
