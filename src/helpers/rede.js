import NetInfo from '@react-native-community/netinfo';

const CODIGO_TEMPO_LIMITE = 'tempo-limite';

// isInternetReachable === null significa "ainda não verificado": nesse caso vale o isConnected
export async function estaOnline() {
  const { isConnected, isInternetReachable } = await NetInfo.fetch();
  return !!isConnected && isInternetReachable !== false;
}

// Sem internet de fato, o SDK do Firestore segura a escrita em memória e a promise nunca resolve
export function comTempoLimite(promessa, milissegundos) {
  let temporizador;
  const limite = new Promise((_, rejeitar) => {
    temporizador = setTimeout(() => {
      const erro = new Error('Tempo limite de rede excedido');
      erro.code = CODIGO_TEMPO_LIMITE;
      rejeitar(erro);
    }, milissegundos);
  });
  return Promise.race([promessa, limite]).finally(() => clearTimeout(temporizador));
}

export const estourouTempoLimite = (erro) => erro?.code === CODIGO_TEMPO_LIMITE;
