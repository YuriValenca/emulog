import AsyncStorage from '@react-native-async-storage/async-storage';

// Função para salvar dados
export const storeData = async (key, value) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Erro ao salvar dados no AsyncStorage", e);
  }
};

// Função para recuperar dados
export const getData = async (key) => {
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      return JSON.parse(value);
    }
  } catch (e) {
    console.error("Erro ao recuperar dados do AsyncStorage", e);
  }
};


