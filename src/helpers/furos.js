import { paraKg, kgParaTexto, kgPreenchido } from './numeros';

let contadorDeFuros = 0;

// O id só existe no aparelho, pra key da lista não embaralhar os inputs quando um furo do meio é apagado
const gerarIdFuro = () => `${Date.now()}-${contadorDeFuros++}`;

export const criarFuro = (kg = '') => ({ id: gerarIdFuro(), kg });

export const furoPreenchido = (furo) => paraKg(furo?.kg) !== null;

export const furosTemDados = (furos) => (furos || []).some(furo => kgPreenchido(furo?.kg));

export const listarFurosVazios = (furos) =>
  (furos || [])
    .map((furo, indice) => ({ numero: indice + 1, preenchido: furoPreenchido(furo) }))
    .filter(({ preenchido }) => !preenchido)
    .map(({ numero }) => numero);

export const somarFuros = (furos) =>
  (furos || []).reduce((total, furo) => total + (paraKg(furo?.kg) ?? 0), 0);

export const furosParaSalvar = (furos) =>
  (furos || []).filter(furoPreenchido).map(furo => ({ kg: paraKg(furo.kg) }));

export const furosParaFormulario = (furos) =>
  (furos || []).map(furo => (furo?.id ? furo : criarFuro(kgParaTexto(furo?.kg))));
