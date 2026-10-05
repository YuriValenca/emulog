export function paraDecimal(valor) {
  if (typeof valor === 'number') return valor;
  if (typeof valor !== 'string') return NaN;
  return parseFloat(valor.trim().replace(',', '.'));
}
