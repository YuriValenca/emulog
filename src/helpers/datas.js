export function paraData(valor) {
  if (valor?.toDate) return valor.toDate();
  if (valor?.seconds !== undefined) return new Date(valor.seconds * 1000 + (valor.nanoseconds ?? 0) / 1e6);
  return new Date(valor);
}

export const mesmoDia = (a, b) => paraData(a).toDateString() === paraData(b).toDateString();

export function formatarDataHora(valor) {
  const data = paraData(valor);
  if (isNaN(data.getTime())) return 'Data inválida';
  const d = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  const y = String(data.getFullYear()).slice(-2);
  const h = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} (${h}:${min}h)`;
}
