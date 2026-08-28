export function formatCNPJ(value) {
  const raw = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 14);

  if (raw.length <= 2) return raw;
  if (raw.length <= 5) return `${raw.slice(0, 2)}.${raw.slice(2)}`;
  if (raw.length <= 8) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5)}`;
  if (raw.length <= 12) return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8)}`;
  return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12, 14)}`;
}

export function unmaskCNPJ(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function charValue(char) {
  return char.charCodeAt(0) - 48;
}

function calcDigit(base, weights) {
  const sum = base
    .split('')
    .reduce((acc, char, i) => acc + charValue(char) * weights[i], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

export function isValidCNPJ(value) {
  const cnpj = unmaskCNPJ(value);
  if (cnpj.length !== 14) return false;

  if (!/^\d{2}$/.test(cnpj.slice(12))) return false;

  if (/^(.)\1{13}$/.test(cnpj)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const base = cnpj.slice(0, 12);
  const digit1 = calcDigit(base, weights1);
  const digit2 = calcDigit(base + digit1, weights2);

  return cnpj.slice(12) === `${digit1}${digit2}`;
}
