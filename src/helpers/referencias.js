export const paraRefCaminhao = (caminhao) => (caminhao ? { id: caminhao.id, placa: caminhao.placa } : null);

export const paraRefsEquipe = (equipe) => (equipe || []).map(({ id, nome }) => ({ id, nome }));
