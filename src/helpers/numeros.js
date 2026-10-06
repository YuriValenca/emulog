export function paraDecimal(valor) {
  if (typeof valor === 'number') return valor;
  if (typeof valor !== 'string') return NaN;
  return parseFloat(valor.trim().replace(',', '.'));
}

const SO_MILHAR_COM_PONTO = /^\d{1,3}(\.\d{3})+$/;

function normalizarKgPtBr(texto) {
  if (texto.includes(',')) return texto.replace(/\./g, '').replace(',', '.');
  if (SO_MILHAR_COM_PONTO.test(texto)) return texto.replace(/\./g, '');
  return texto;
}

// Mesma regra do paraKg do portal (Emulog-portal/src/helpers/parseNumbers.ts): os dois têm que chegar no mesmo número
export function paraKg(valor) {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;

  const limpo = String(valor).trim();
  if (!limpo) return null;

  const numero = parseFloat(normalizarKgPtBr(limpo));
  return Number.isFinite(numero) ? numero : null;
}

// O teclado numérico do Android ainda deixa passar "-", espaço e texto colado
export function limparKgDigitado(texto) {
  const soNumerosEPontuacao = String(texto ?? '').replace(/[^\d.,]/g, '');
  const primeiraVirgula = soNumerosEPontuacao.indexOf(',');
  if (primeiraVirgula === -1) return soNumerosEPontuacao;
  return soNumerosEPontuacao.slice(0, primeiraVirgula + 1)
    + soNumerosEPontuacao.slice(primeiraVirgula + 1).replace(/,/g, '');
}

export function kgParaTexto(valor) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'string') return valor;
  return Number.isFinite(valor) ? String(valor).replace('.', ',') : '';
}

export const kgPreenchido = (valor) => valor !== null && valor !== undefined && String(valor).trim() !== '';

export function formatarKg(valor) {
  const numero = paraKg(valor);
  return numero === null ? String(valor) : numero.toLocaleString('pt-BR');
}
