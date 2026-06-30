import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { getElectoralAnomalies, classifySinal, ELECTION_YEARS, INDICADOR, type Porte, type SinalEleitoral } from "@/server/anomaly/electoralCycle";
import { getRjCriminalGovernance, ANO_REF, type Classificacao } from "@/server/anomaly/criminalGovernance";
import { getCriminalGovernanceNacional, type GovClass } from "@/server/anomaly/criminalGovernanceNacional";
import { FACTION_SOURCE, type PresencaCrimeOrg } from "@/server/anomaly/factionPresence";

const GOV_LABEL: Record<GovClass, string> = {
  controle: "intensidade baixa · investigar",
  disputa: "disputa ativa",
  misto: "misto",
  sem_faccao: "sem facção nacional",
};
const GOV_STYLE: Record<GovClass, string> = {
  controle: "bg-amber-300/15 text-amber-200",
  disputa: "bg-red-400/15 text-red-200",
  misto: "text-slate-400",
  sem_faccao: "text-slate-600",
};
const UF_NOME: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
  DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso",
  MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná",
  PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
import { getHiddenHomicides } from "@/server/anomaly/hiddenHomicides";
import { WeeklyDigest } from "@/components/radar/WeeklyDigest";

const PORTE_LABEL: Record<Porte, string> = {
  grande: "grande",
  medio: "médio",
  pequeno: "pequeno",
  micro: "micro",
};

const PRESENCA_LABEL: Record<PresencaCrimeOrg, string> = {
  alta: "alta (PCC+CV)",
  media: "média (1 facção)",
  baixa: "sem facção nac. doc.",
};
const PRESENCA_STYLE: Record<PresencaCrimeOrg, string> = {
  alta: "text-red-200",
  media: "text-amber-200",
  baixa: "text-slate-500",
};

const CLASS_LABEL: Record<Classificacao, string> = {
  controle: "possível controle",
  disputa: "disputa ativa",
  misto: "misto",
};
const CLASS_STYLE: Record<Classificacao, string> = {
  controle: "bg-amber-300/15 text-amber-200",
  disputa: "bg-red-400/15 text-red-200",
  misto: "text-slate-500",
};
function n(v: number | null): string {
  return v === null ? "—" : String(v);
}

export const metadata: Metadata = {
  title: "Radar de anomalia — ciclo eleitoral",
  description: "Quedas atípicas do homicídio reportado na janela pré-eleitoral, por UF (indício, não prova).",
  robots: { index: false, follow: false }, // feature preliminar / sensível
};

function fmt(n: number | null): string {
  return n === null ? "—" : n.toFixed(3);
}

function sinalBadge(sinal: SinalEleitoral) {
  switch (sinal) {
    case "forte":
      return (
        <span className="rounded-full bg-red-400/15 px-2 py-0.5 text-[11px] font-semibold text-red-200">
          indício forte · investigar
        </span>
      );
    case "isolado":
      return (
        <span className="rounded-full bg-amber-300/10 px-2 py-0.5 text-[11px] text-amber-200/80" title="cai mais que os pares, mas sem facção documentada na UF — não promovido">
          isolado (sem facção)
        </span>
      );
    default:
      return <span className="text-[11px] text-slate-500">{sinal === "baixa_amostra" ? "baixa amostra" : "sem desvio relevante"}</span>;
  }
}

export default function RadarPage() {
  const ufs = getElectoralAnomalies().map((u) => ({ ...u, ...classifySinal(u.uf, u.efeitoRelativo, u.robusto) }));
  const fortes = ufs.filter((u) => u.sinal === "forte").length;
  const rj = getRjCriminalGovernance();
  const gov = getCriminalGovernanceNacional();
  const govControle = gov.ufs.filter((u) => u.classificacao === "controle").length;
  const govDisputa = gov.ufs.filter((u) => u.classificacao === "disputa").length;
  const oculto = getHiddenHomicides();
  const ocultos = oculto.ufs.filter((u) => u.sinal === "indicio_oculto").length;

  return (
    <main className="flex min-h-screen flex-col text-slate-100">
      <AppHeader />
      <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col gap-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-cyan-300">Radar de anomalia</p>
            <h2 className="text-2xl font-semibold">Ciclo eleitoral × homicídio (dado oficial)</h2>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 px-3 py-2 text-sm font-medium text-red-100 hover:border-red-400/60 hover:text-red-50"
          >
            🎯 Radar de tiroteios (tempo quase real)
          </Link>
        </div>

        {/* Aviso inegociável: indício, não prova */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Indício para investigar, não prova de manipulação.</strong> Um efeito negativo significa que o
            homicídio reportado cai na janela pré-eleitoral (ago–out) em anos de eleição mais do que em anos normais.
            Isso pode ter causas legítimas (operação policial, mudança de registro), ser subnotificação/reclassificação,
            ou coincidência. A literatura indica que esse ciclo costuma aparecer onde há crime organizado — por isso a
            próxima lente cruza com presença de facção/milícia.
          </p>
        </div>

        {/* Metodologia */}
        <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
          <p>
            <strong>Como é medido:</strong> índice sazonal intra-UF (média ago–out ÷ média do ano), comparando anos de
            eleição ({ELECTION_YEARS.join(", ")}) com anos normais (2015–2025) — esse é o <em>efeito</em>. Depois um{" "}
            <strong>diff-in-diff vs pares</strong>: subtrai-se a mediana do efeito das UFs de <em>mesmo porte</em>, isolando
            quem cai <em>mais que os pares</em> (o <strong>efeito vs pares</strong>) e não o padrão pré-eleitoral comum aos
            pares de mesmo porte (seja queda ou alta).{" "}
            <strong>Nunca ranking cru</strong> entre UFs heterogêneas (IPEA). Por fim, o sinal só é{" "}
            <strong>&quot;forte&quot;</strong> quando <strong>cruzado com presença de facção</strong> na UF — a literatura
            (<em>Review of Economic Studies</em> 86(2), 2018) indica que o ciclo eleitoral de homicídios só aparece onde há
            crime organizado; sem facção nacional documentada, fica{" "}
            <strong>&quot;isolado&quot;</strong> (não promovido). Indicador: {INDICADOR}. Fontes: SINESP/VDE +{" "}
            {FACTION_SOURCE}. {fortes} UF(s) com indício forte (cai mais que os pares E com facção).{" "}
            <Link className="underline hover:text-cyan-200" href="/metodologia#radar">
              Metodologia
            </Link>
            .
          </p>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">UF</th>
                <th className="px-3 py-2" title="porte por volume mensal de homicídios">Porte</th>
                <th className="px-3 py-2" title="idxEleicao − idxNormal; negativo = queda pré-eleitoral (bruto)">Efeito</th>
                <th className="px-3 py-2" title="efeito − mediana dos pares de mesmo porte (DiD); negativo = cai mais que os pares">Efeito vs pares</th>
                <th className="px-3 py-2">Média/mês</th>
                <th className="px-3 py-2" title="facções nacionais que atuam na UF (Mapa das Orcrim 2024/MJ)">Crime org.</th>
                <th className="px-3 py-2">Sinal</th>
              </tr>
            </thead>
            <tbody>
              {ufs.map((u, i) => (
                <tr
                  key={u.uf}
                  className={`border-t border-white/5 ${u.sinal === "forte" ? "bg-amber-300/5" : ""} ${!u.robusto ? "text-slate-500" : ""}`}
                >
                  <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-3 py-2 font-semibold text-slate-100">{u.uf}</td>
                  <td className="px-3 py-2 text-slate-400">{PORTE_LABEL[u.porte]}</td>
                  <td className="px-3 py-2 font-mono text-slate-400">{fmt(u.efeito)}</td>
                  <td className={`px-3 py-2 font-mono ${u.efeitoRelativo !== null && u.efeitoRelativo < 0 ? "text-amber-300" : "text-slate-300"}`}>
                    {fmt(u.efeitoRelativo)}
                  </td>
                  <td className="px-3 py-2 text-slate-400">{u.mediaMensal}</td>
                  <td className={`px-3 py-2 text-[11px] ${PRESENCA_STYLE[u.presenca]}`}>{PRESENCA_LABEL[u.presenca]}</td>
                  <td className="px-3 py-2">{sinalBadge(u.sinal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* LENTE 2 — governança criminal (NACIONAL, 27 UFs) */}
        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-300">Lente 2 · governança criminal</p>
          <h3 className="text-xl font-semibold">Controle (pax) × disputa — por UF, Brasil</h3>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Indício, não acusação.</strong> Onde há crime organizado, violência <strong>atipicamente baixa</strong> com
            facção presente <em>pode</em> indicar <strong>controle/&quot;pax&quot;</strong> (um grupo domina e suprime o confronto
            registrável — <em>nunca</em> lugar seguro) — <strong>ou</strong>, sobretudo em UFs mais desenvolvidas, refletir
            fatores <strong>estruturais</strong> (demografia, base de óbitos mais velha, menor violência histórica). É indício
            para <em>investigar a hipótese</em>, não a leitura. Violência <strong>alta</strong> + facção indica{" "}
            <strong>disputa</strong> (guerra entre grupos). Medimos a <strong>intensidade de homicídio</strong> (homicídios ÷
            óbitos totais) relativa à mediana nacional, cruzada com presença de facção — o ratio também cai por fatores
            estruturais, daí a cautela. Âncoras: <strong>SP</strong> (PCC), a menor intensidade do país; <strong>Norte</strong> =
            facção + intensidade alta → disputa. {govControle} UF(s) com intensidade baixa, {govDisputa} com disputa.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">UF</th>
                <th className="px-3 py-2">Sinal</th>
                <th className="px-3 py-2" title="homicídios ÷ óbitos totais (SIM/DATASUS, recente)">Intensidade</th>
                <th className="px-3 py-2" title="intensidade ÷ mediana nacional">vs mediana</th>
                <th className="px-3 py-2" title="facções nacionais (Mapa das Orcrim/MJ)">Facções</th>
              </tr>
            </thead>
            <tbody>
              {gov.ufs.map((u) => (
                <tr key={u.uf} className={`border-t border-white/5 ${u.classificacao === "controle" ? "bg-amber-300/5" : u.classificacao === "disputa" ? "bg-red-400/5" : ""}`}>
                  <td className="px-3 py-2 font-semibold text-slate-100">
                    {u.uf}
                    <span className="text-slate-500"> · {UF_NOME[u.uf] ?? ""}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${GOV_STYLE[u.classificacao]}`}>
                      {GOV_LABEL[u.classificacao]}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-300">{(u.intensidade * 100).toFixed(2)}%</td>
                  {/* Cor segue a CLASSIFICAÇÃO (não o número cru): UF sem facção
                      fica neutra mesmo com intensidade baixa — alinha com o selo. */}
                  <td className={`px-3 py-2 font-mono ${u.classificacao === "controle" ? "text-amber-300" : u.classificacao === "disputa" ? "text-red-300" : "text-slate-400"}`}>
                    {u.intensRelativa.toFixed(2)}×
                  </td>
                  <td className="px-3 py-2 text-slate-400">{u.faccoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
          <summary className="cursor-pointer text-slate-300">Aprofundamento: detalhe municipal do RJ ({ANO_REF}) — onde há dado mais rico</summary>
          <p className="mt-2 text-xs text-slate-400">
            No RJ há dado municipal de tiroteios (Fogo Cruzado) + extorsão/tráfico (ISP-RJ), que permite a leitura por
            município: tiroteios com ~0% de &quot;disputa&quot; + extorsão ativa = milícia/controle. {rj.filter((r) => r.classificacao === "controle").length} município(s) com indício de controle.
          </p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Município</th>
                  <th className="px-3 py-2">Sinal</th>
                  <th className="px-3 py-2">Tiroteios</th>
                  <th className="px-3 py-2">% disputa</th>
                  <th className="px-3 py-2">Extorsão</th>
                </tr>
              </thead>
              <tbody>
                {rj.map((r) => (
                  <tr key={r.municipio} className={`border-t border-white/5 ${!r.robusto ? "text-slate-500" : ""}`}>
                    <td className="px-3 py-2 font-medium text-slate-200">{r.municipio}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CLASS_STYLE[r.classificacao]}`}>{CLASS_LABEL[r.classificacao]}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{r.tiroteios}</td>
                    <td className="px-3 py-2 font-mono text-slate-300">{(r.disputaShare * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-amber-200/90">{n(r.extorsao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <p className="text-xs text-slate-500">
          Fontes: {gov.fonte}. Detalhe RJ: Fogo Cruzado + ISP-RJ/ISPdados.
        </p>

        {/* LENTE 3 — homicídios ocultos (MVCI) */}
        <div className="mt-6 border-t border-white/10 pt-5">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-300">Lente 3 · homicídios ocultos</p>
          <h3 className="text-xl font-semibold">Assinatura de ouro — homicídio ↓ enquanto MVCI ↑</h3>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Indício de subnotificação, não acusação.</strong> Quando o homicídio registrado (CID X85–Y09){" "}
            <strong>cai</strong> enquanto a morte por intenção indeterminada (MVCI, Y10–Y34) <strong>sobe</strong>, parte da
            queda pode ser <em>reclassificação</em>, não redução real (~43,6% das MVCI eram homicídios — SciELO 2025).
            Como essa alta da MVCI é uma <strong>tendência nacional</strong> no período, comparamos cada UF ao{" "}
            <strong>baseline do país</strong>{oculto.baseline != null ? ` (mediana +${(oculto.baseline * 100).toFixed(1)} p.p.)` : ""}:
            só vira indício quem sobe <em>muito acima</em> dessa tendência. Complementa a lente 1 (CE aparece nas duas).
            Fonte: {oculto.fonte}.
          </p>
        </div>

        {oculto.pendente ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-slate-400">
            <p className="font-semibold text-slate-300">Dados pendentes de geração.</p>
            <p className="mt-1">
              A lib e a UI estão prontas; falta gerar o asset (run offline pesado do SIM/DATASUS, fora do CI):
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-slate-950/60 p-3 text-xs text-slate-300">python3 etl/build_hidden_homicides.py --anos 2015-2024</pre>
            <p className="mt-2">Ao commitar o <code>src/data/hiddenHomicides.json</code> gerado, esta seção acende automaticamente.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-500">{ocultos} UF(s) com indício: homicídio caindo E razão MVCI subindo bem acima da tendência nacional.</p>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2">UF</th>
                    <th className="px-3 py-2" title="variação dos homicídios (2ª metade vs 1ª)">Homicídio</th>
                    <th className="px-3 py-2" title="razão MVCI inicial → final">Razão MVCI</th>
                    <th className="px-3 py-2" title="alta bruta da razão MVCI (p.p.)">Δ MVCI</th>
                    <th className="px-3 py-2" title="Δ MVCI menos a mediana nacional (DiD); positivo = sobe mais que o país">Δ vs Brasil</th>
                    <th className="px-3 py-2">Sinal</th>
                  </tr>
                </thead>
                <tbody>
                  {oculto.ufs.map((u) => (
                    <tr key={u.uf} className={`border-t border-white/5 ${u.sinal === "indicio_oculto" ? "bg-amber-300/5" : ""} ${!u.robusto ? "text-slate-500" : ""}`}>
                      <td className="px-3 py-2 font-semibold text-slate-100">{u.uf}</td>
                      <td className={`px-3 py-2 font-mono ${u.homPct < 0 ? "text-amber-300" : "text-slate-300"}`}>{(u.homPct * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 font-mono text-slate-400">{fmt(u.razaoInicial)} → {fmt(u.razaoFinal)}</td>
                      <td className="px-3 py-2 font-mono text-slate-400">
                        {u.razaoDelta === null ? "—" : (u.razaoDelta > 0 ? "+" : "") + (u.razaoDelta * 100).toFixed(2) + " p.p."}
                      </td>
                      <td className={`px-3 py-2 font-mono ${u.razaoDeltaRelativo !== null && u.razaoDeltaRelativo >= 0.03 ? "text-amber-300" : "text-slate-400"}`}>
                        {u.razaoDeltaRelativo === null ? "—" : (u.razaoDeltaRelativo > 0 ? "+" : "") + (u.razaoDeltaRelativo * 100).toFixed(2) + " p.p."}
                      </td>
                      <td className="px-3 py-2">
                        {!u.robusto ? (
                          <span className="text-[11px] text-slate-500">baixa amostra</span>
                        ) : u.sinal === "indicio_oculto" ? (
                          <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">indício oculto · investigar</span>
                        ) : (
                          <span className="text-[11px] text-slate-500">sem assinatura</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <WeeklyDigest />
      </div>
    </main>
  );
}
