// Presença das facções nacionais (PCC, Comando Vermelho) por UF — para CRUZAR
// com o sinal eleitoral (#85). A literatura (Review of Economic Studies 86(2),
// 2018 — Alesina, Piccolo & Pinotti) mostra que o ciclo eleitoral de homicídios
// só aparece ONDE HÁ crime organizado capaz de modular a violência — logo um
// sinal eleitoral só é promovido a "forte" quando cruzado com presença de facção;
// isolado, é mais provável ter causa benigna (operação, mudança de registro).
//
// FONTE: Relatório "Mapa das Organizações Criminosas 2024", Ministério da Justiça
// (PCC em 24 UFs, CV em 22). É PRESENÇA documentada (sistema prisional/atuação),
// NÃO um índice de dominância territorial — por isso usamos só uma gradação coarse
// (quantas das 2 facções nacionais atuam). RJ aparece aqui só com CV, mas tem
// também milícias dominantes (vide lente 2); a gradação por isso SUBESTIMA o RJ.
// DF/RS aparecem com 0: o relatório MJ 2024 (autodeclarado pelo sistema prisional)
// registra que o DF deixou de listar PCC e CV em 2024 — "sem facção NACIONAL", o
// que NÃO significa ausência de crime organizado (Brasília tem facção local, o CDC,
// fora das duas nacionais que esta gradação enxerga). INDÍCIO/contexto, nunca acusação.

export interface FactionPresence {
  pcc: boolean;
  cv: boolean;
}

export const FACTION_SOURCE = "Mapa das Organizações Criminosas 2024 (Ministério da Justiça)";

// true/true salvo onde a fonte não lista a facção. (DF e RS: nenhuma das duas;
// RJ: só CV; RN/SP/SE: só PCC.)
export const FACTION_PRESENCE: Record<string, FactionPresence> = {
  AC: { pcc: true, cv: true }, AL: { pcc: true, cv: true }, AP: { pcc: true, cv: true },
  AM: { pcc: true, cv: true }, BA: { pcc: true, cv: true }, CE: { pcc: true, cv: true },
  DF: { pcc: false, cv: false }, ES: { pcc: true, cv: true }, GO: { pcc: true, cv: true },
  MA: { pcc: true, cv: true }, MT: { pcc: true, cv: true }, MS: { pcc: true, cv: true },
  MG: { pcc: true, cv: true }, PA: { pcc: true, cv: true }, PB: { pcc: true, cv: true },
  PR: { pcc: true, cv: true }, PE: { pcc: true, cv: true }, PI: { pcc: true, cv: true },
  RJ: { pcc: false, cv: true }, RN: { pcc: true, cv: false }, RO: { pcc: true, cv: true },
  RR: { pcc: true, cv: true }, RS: { pcc: false, cv: false }, SC: { pcc: true, cv: true },
  SP: { pcc: true, cv: false }, SE: { pcc: true, cv: false }, TO: { pcc: true, cv: true },
};

export type PresencaCrimeOrg = "alta" | "media" | "baixa"; // 2 / 1 / 0 facções nacionais

// Quantas das 2 facções nacionais atuam na UF (0..2), por defeito 0 (UF ausente).
export function faccoesNaUf(uf: string): number {
  const f = FACTION_PRESENCE[uf];
  return f ? (f.pcc ? 1 : 0) + (f.cv ? 1 : 0) : 0;
}

export function presencaCrimeOrg(uf: string): PresencaCrimeOrg {
  const n = faccoesNaUf(uf);
  return n >= 2 ? "alta" : n === 1 ? "media" : "baixa";
}
