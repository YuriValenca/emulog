export const JANELA_DE_ESTABILIDADE_MS = 2000;
const FAIXA_G = 10;
const PARTES_DA_JANELA = 3;
const DIFERENCA_MAXIMA_ENTRE_PARTES_G = 2;

const media = (leituras) => leituras.reduce((soma, { peso }) => soma + peso, 0) / leituras.length;

const amplitude = (leituras) => {
  const pesos = leituras.map(({ peso }) => peso);
  return Math.max(...pesos) - Math.min(...pesos);
};

const arredondarDecigrama = (peso) => Math.round(peso * 10) / 10;

const mediasDasPartes = (leituras) => Array.from({ length: PARTES_DA_JANELA }, (_, parte) => media(leituras.slice(
  Math.floor((parte * leituras.length) / PARTES_DA_JANELA),
  Math.floor(((parte + 1) * leituras.length) / PARTES_DA_JANELA),
)));

// Tremor oscila em volta do peso real e as partes da janela concordam; peso descendo, subindo
// ou passando por um pico (mão encostada, copo assentando) deixa uma parte diferente das outras
const partesConcordam = (leituras) => {
  if (leituras.length < PARTES_DA_JANELA) return true;
  const medias = mediasDasPartes(leituras);
  return Math.max(...medias) - Math.min(...medias) <= DIFERENCA_MAXIMA_ENTRE_PARTES_G;
};

// A leitura mais antiga fica mesmo fora da janela: é ela que prova que o peso já está na faixa há tempo suficiente
export function registrarLeitura(leituras, leitura) {
  const janela = [...leituras, leitura];
  while (amplitude(janela) > FAIXA_G) janela.shift();
  while (janela.length > 1 && leitura.instante - janela[1].instante >= JANELA_DE_ESTABILIDADE_MS) janela.shift();
  return janela;
}

export function pesoEstavelDaJanela(leituras, agora) {
  if (leituras.length < 2 || agora - leituras[0].instante < JANELA_DE_ESTABILIDADE_MS) return null;
  if (!partesConcordam(leituras)) return null;
  return arredondarDecigrama(media(leituras));
}
