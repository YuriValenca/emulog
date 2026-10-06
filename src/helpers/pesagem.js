export const PESAGENS_POR_AMOSTRA = 5;
export const PESAGENS_OBRIGATORIAS = 4;

export const criarPesagemVazia = () => ({ peso: null, densidade: null, timestamp: null });

export const criarAmostraVazia = () =>
  Array.from({ length: PESAGENS_POR_AMOSTRA }, criarPesagemVazia);

export const pesagemConcluida = (pesagem) =>
  pesagem?.peso !== null && pesagem?.peso !== undefined && pesagem?.peso !== '';

export const contarPesagensConcluidas = (amostra) => (amostra || []).filter(pesagemConcluida).length;

export const textoPesagens = (quantidade) => (quantidade === 1 ? '1 pesagem' : `${quantidade} pesagens`);
export const textoAmostras = (quantidade) => (quantidade === 1 ? '1 amostra' : `${quantidade} amostras`);

export function formatarHoraPesagem(timestamp) {
  if (!timestamp) return '';
  const data = new Date(timestamp);
  // Pesagens antigas guardavam só a hora no formato do aparelho ("14:32:05"), que o Date não consegue ler
  return isNaN(data.getTime()) ? timestamp : data.toLocaleTimeString('pt-BR');
}
