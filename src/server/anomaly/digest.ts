// Digest semanal do radar de anomalia por IA (#85) — SERVER-ONLY.
//
// Resume em texto os sinais das lentes 1 (ciclo eleitoral, DiD vs pares) e 2
// (governança criminal no RJ), SEMPRE com a moldura: indício para investigar,
// nunca acusação; apartidário; citando fontes e os confundidores que o IPEA
// enumera. O prompt é construído de forma determinística (puro/testável); a
// chamada de IA reusa o rodízio de provedores grátis.
import "server-only";
import { getElectoralAnomalies, classifySinal } from "@/server/anomaly/electoralCycle";
import { getRjCriminalGovernance } from "@/server/anomaly/criminalGovernance";
import { completeText, hasChatProvider } from "@/server/ai/chat";
import { FACTION_SOURCE } from "@/server/anomaly/factionPresence";

export interface DigestSignals {
  indicador: string;
  eleitorais: { uf: string; porte: string; efeito: number; efeitoRelativo: number; presenca: string }[];
  governanca: { municipio: string; disputaShare: number; extorsao: number | null }[];
}

export const FONTES = [
  "SINESP/VDE (homicídios por UF)",
  "Fogo Cruzado (tiroteios georreferenciados)",
  "ISP-RJ/ISPdados (criminalidade municipal)",
  FACTION_SOURCE, // presença de facção por UF (cross-gating da lente 1)
];

// Coleta os sinais que merecem destaque: indícios eleitorais FORTES (caem mais que
// os pares E cruzados com presença de facção na UF) + municípios do RJ com indício
// de controle territorial.
export function gatherSignals(): DigestSignals {
  const eleitorais = getElectoralAnomalies()
    .map((u) => ({ u, ...classifySinal(u.uf, u.efeitoRelativo, u.robusto) }))
    .filter((x) => x.sinal === "forte")
    .map(({ u, presenca }) => ({ uf: u.uf, porte: u.porte, efeito: u.efeito as number, efeitoRelativo: u.efeitoRelativo as number, presenca }));
  const governanca = getRjCriminalGovernance()
    .filter((g) => g.classificacao === "controle")
    .map((g) => ({ municipio: g.municipio, disputaShare: g.disputaShare, extorsao: g.extorsao }));
  return { indicador: "homicídio doloso (SINESP/VDE)", eleitorais, governanca };
}

// Monta (system, user) de forma determinística — PURO/testável.
export function buildDigestPrompt(s: DigestSignals): { system: string; user: string } {
  const system = `Você é um analista de segurança pública escrevendo um boletim semanal SÓBRIO em português do Brasil.
REGRAS INEGOCIÁVEIS:
- Tudo é INDÍCIO PARA INVESTIGAR, NUNCA acusação ou prova de manipulação.
- APARTIDÁRIO: não cite partidos, candidatos ou governos específicos.
- Sempre lembre os CONFUNDIDORES legítimos (operação policial real, mudança de notificação/registro, alteração legislativa, subnotificação) ao lado de cada sinal.
- Cite as FONTES dos dados ao final.
- Máx. ~180 palavras, tom técnico e cauteloso, sem alarmismo. Não invente números além dos fornecidos.`;
  const linhasEle = s.eleitorais.length
    ? s.eleitorais.map((e) => `- ${e.uf} (porte ${e.porte}): cai ${(e.efeitoRelativo * 100).toFixed(1)}% mais que os pares na janela pré-eleitoral (efeito bruto ${(e.efeito * 100).toFixed(1)}%); presença de facção ${e.presenca} — sinal cruzado com crime organizado.`).join("\n")
    : "- (nenhum sinal eleitoral forte: nenhuma UF cai mais que os pares E com facção nesta janela)";
  const linhasGov = s.governanca.length
    ? s.governanca.map((g) => `- ${g.municipio}: tiroteios com apenas ${(g.disputaShare * 100).toFixed(1)}% de "disputa" entre grupos${g.extorsao != null ? `, extorsão registrada ${g.extorsao}` : ""} — indício de controle/monopólio territorial.`).join("\n")
    : "- (nenhum município com indício de controle nesta janela)";
  const user = `Indicador base: ${s.indicador}.

LENTE 1 — ciclo eleitoral (comparação por pares de mesmo porte, diff-in-diff; nunca ranking cru; só "forte" quando cruzado com presença de facção):
${linhasEle}

LENTE 2 — governança criminal (RJ; controle territorial × disputa):
${linhasGov}

FONTES: ${FONTES.join("; ")}.

Escreva o boletim semanal resumindo esses indícios com a moldura das regras.`;
  return { system, user };
}

export interface DigestResult {
  texto: string;
  provedor: string;
  geradoEm: string;
  fontes: string[];
  sinais: { eleitorais: number; governanca: number };
}

// Gera o digest chamando a IA. null se nenhum provedor estiver configurado
// (degradação graciosa — a página mostra aviso).
export async function generateDigest(): Promise<DigestResult | null> {
  if (!hasChatProvider()) return null;
  const sinais = gatherSignals();
  const { system, user } = buildDigestPrompt(sinais);
  const out = await completeText(system, user);
  if (!out) return null;
  return {
    texto: out.text,
    provedor: out.provedor,
    geradoEm: new Date().toISOString(),
    fontes: FONTES,
    sinais: { eleitorais: sinais.eleitorais.length, governanca: sinais.governanca.length },
  };
}
