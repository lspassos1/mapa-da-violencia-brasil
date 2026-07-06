import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = {
  title: "Metodologia",
  description:
    "Como o Mapa da Violência Brasil separa registro oficial de indício: o mapa da Base VDE, as três lentes do radar de anomalia, a camada OSINT e a stack que sustenta tudo.",
  alternates: { canonical: "/metodologia" },
};

// Tela Metodologia — composição do handoff (princípios numerados, camadas lado
// a lado, fontes e avisos) + o aprofundamento honesto (score relativo, lentes,
// pipeline OSINT) que a auditoria de metodologia exigiu manter.
export default function MethodologyPage() {
  return (
    <main className="flex min-h-screen flex-col bg-bg0 text-ink">
      <AppHeader />

      {/* header */}
      <div className="border-b border-line px-7 pb-[30px] pt-[34px]">
        <div className="flex items-center gap-2.5 font-mono text-[10px] tracking-[.28em] text-sec">
          <span className="inline-block h-px w-[22px] bg-quat" />
          METODOLOGIA
        </div>
        <h1 className="mt-3 text-[32px] font-[620] leading-[1.04] tracking-[-0.015em] [font-stretch:115%] sm:text-[42px]">
          A moldura inegociável
        </h1>
      </div>

      {/* 3 princípios */}
      <div className="grid grid-cols-1 border-b border-line md:grid-cols-3">
        <div className="border-r border-hair px-[26px] py-7">
          <div className="font-mono text-[30px] text-ghost2">01</div>
          <h2 className="mt-3 text-[20px] font-[620] leading-[1.3] [font-stretch:110%]">Indício não é estatística.</h2>
          <p className="mt-2 text-[13px] leading-[1.65] text-ter">
            As três camadas têm fidelidades diferentes e <span className="text-[#C9C7C1]">nunca se misturam</span>. Cada
            ponto no mapa declara sua natureza: registro, indício ou dado oficial.
          </p>
        </div>
        <div className="border-r border-hair px-[26px] py-7">
          <div className="font-mono text-[30px] text-ghost2">02</div>
          <h2 className="mt-3 text-[20px] font-[620] leading-[1.3] [font-stretch:110%]">Indício serve para investigar.</h2>
          <p className="mt-2 text-[13px] leading-[1.65] text-ter">
            Nunca para acusar. Anomalia estatística aponta <span className="text-[#C9C7C1]">onde olhar</span> — jamais
            conclui sobre eventos ou pessoas específicas.
          </p>
        </div>
        <div className="px-[26px] py-7">
          <div className="font-mono text-[30px] text-ghost2">03</div>
          <h2 className="mt-3 text-[20px] font-[620] leading-[1.3] [font-stretch:110%]">Apartidário, com fonte.</h2>
          <p className="mt-2 text-[13px] leading-[1.65] text-ter">
            Toda afirmação carrega a origem do dado e a ressalva metodológica. O código é aberto —{" "}
            <span className="text-[#C9C7C1]">AGPL-3.0</span>, auditável por qualquer pessoa.
          </p>
        </div>
      </div>

      {/* camadas lado a lado */}
      <div className="border-b border-line px-7 py-[26px]">
        <h2 className="mb-3.5 font-mono text-[9.5px] tracking-[.24em] text-quat">AS CAMADAS, LADO A LADO</h2>
        <div className="overflow-x-auto border border-line">
          <div className="grid min-w-[760px] grid-cols-[1.3fr_1.2fr_1fr_1fr_1fr] gap-px bg-line">
            {["CAMADA", "FONTE", "NATUREZA", "PRECISÃO", "ATUALIZAÇÃO"].map((h) => (
              <div key={h} className="bg-cellhead px-3.5 py-2.5 font-mono text-[8.5px] tracking-[.18em] text-quat">
                {h}
              </div>
            ))}

            <div className="flex items-center gap-2 bg-panel px-3.5 py-3 text-[13px] text-ink">
              <span className="h-[7px] w-[7px] flex-none rounded-full bg-registro" />
              Radar de tiroteios
            </div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">Fogo Cruzado · API v2</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">registro georreferenciado</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">exata (lat/lon)</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">tempo quase real · 4 RMs</div>

            <div className="flex items-center gap-2 bg-panel px-3.5 py-3 text-[13px] text-ink">
              <span className="h-[7px] w-[7px] flex-none rotate-45 border border-indicio" />
              Camada OSINT
            </div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">Google Notícias RSS + IA (keyword-first)</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-indicio">indício de notícia</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">municipal (dicionário IBGE)</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">ingestão por cron · nacional</div>

            <div className="flex items-center gap-2 bg-panel px-3.5 py-3 text-[13px] text-ink">
              <span className="h-[7px] w-[7px] flex-none bg-quat" />
              Mapa oficial
            </div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">SINESP/MJSP · Base VDE</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">estatística oficial</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">município / UF</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">mensal · nacional</div>

            <div className="flex items-center gap-2 bg-panel px-3.5 py-3 text-[13px] text-ink">
              <span className="h-[7px] w-[7px] flex-none rounded-full border border-dashed border-indicio" />
              Radar de anomalia
            </div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">SIM/DATASUS × VDE × ISP-RJ × MJ/Orcrim</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-indicio">inferência estatística</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">UF · pares de porte</div>
            <div className="bg-panel px-3.5 py-3 text-[12px] text-sec">anual / semanal (digest)</div>
          </div>
        </div>
      </div>

      {/* fontes + avisos */}
      <div className="grid grid-cols-1 border-b border-line md:grid-cols-2">
        <div className="border-r border-hair px-7 py-[26px]">
          <h2 className="mb-3.5 font-mono text-[9.5px] tracking-[.24em] text-quat">FONTES DE DADOS</h2>
          <div className="flex flex-col gap-2.5 text-[13px] leading-[1.5]">
            {(
              [
                ["FOGO CRUZADO", "Tiroteios georreferenciados — RMs de Rio de Janeiro, Recife, Salvador e Belém"],
                ["SINESP/MJSP", "Base VDE — homicídio doloso oficial por município e UF (medido em vítimas)"],
                ["SIM/DATASUS", "Mortalidade — homicídio (X85–Y09) × causa indeterminada (Y10–Y34)"],
                ["ISP-RJ", "Criminalidade municipal do Rio de Janeiro"],
                ["IBGE", "Malha de estados, municípios e centroides (geocoding por dicionário)"],
                ["MJ/ORCRIM", "Mapa das organizações criminosas 2024 — presença de facção por UF"],
                ["GOOGLE NOTÍCIAS", "RSS — matéria-prima da camada OSINT (classificação keyword-first)"],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <span className="w-[130px] flex-none pt-0.5 font-mono text-[10px] text-quat">{k}</span>
                <span className="text-sec">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-7 py-[26px]">
          <h2 className="mb-3.5 font-mono text-[9.5px] tracking-[.24em] text-quat">AVISOS</h2>
          <div className="flex flex-col gap-3.5">
            <div className="border-l-2 border-registro py-0.5 pl-3.5">
              <h3 className="text-[13.5px] font-semibold text-ink">Não é alerta de emergência</h3>
              <p className="mt-1 text-[12.5px] leading-[1.6] text-ter">
                Em urgências, ligue <span className="font-semibold text-registro">190</span>. Esta aplicação não mede
                risco individual em tempo real.
              </p>
            </div>
            <div className="border-l-2 border-indicio py-0.5 pl-3.5">
              <h3 className="text-[13.5px] font-semibold text-ink">Indício não é prova</h3>
              <p className="mt-1 text-[12.5px] leading-[1.6] text-ter">
                Camadas de notícia e anomalia não devem ser usadas para vigilância, previsão de crime ou conclusões
                sobre pessoas específicas.
              </p>
            </div>
            <div className="border-l-2 border-quat py-0.5 pl-3.5">
              <h3 className="text-[13.5px] font-semibold text-ink">O dado oficial também erra</h3>
              <p className="mt-1 text-[12.5px] leading-[1.6] text-ter">
                Subnotificação, revisões e diferenças metodológicas entre fontes existem — por isso o radar de anomalia
                existe.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== APROFUNDAMENTO (mantido da auditoria de metodologia) ===== */}

      {/* mapa oficial: como ler o score */}
      <div className="border-b border-line px-7 py-[26px]">
        <h2 className="mb-3.5 font-mono text-[9.5px] tracking-[.24em] text-quat">O MAPA OFICIAL — COMO LER</h2>
        <div className="max-w-[860px] space-y-3 text-[13.5px] leading-[1.7] text-sec">
          <p>
            A fonte é a <strong className="text-ink">Base VDE do SINESP/MJSP</strong> (carga nacional, 27 UFs e
            municípios, de 2015 em diante). O valor exibido é de <strong className="text-ink">vítimas registradas</strong>,
            não ocorrências. A taxa por 100 mil usa população <strong className="text-ink">IBGE 2025</strong> enquanto a
            série populacional histórica não é integrada.
          </p>
          <div className="border border-[rgba(226,163,59,.3)] bg-[rgba(226,163,59,.05)] p-3.5 text-[13px] leading-[1.65] text-indiciotx">
            <strong className="text-indicio">O score 0–100 é posição relativa, não severidade absoluta.</strong> Ele é o{" "}
            <em>percentil</em> do município entre os outros carregados naquele período e indicador — recalculado a cada
            recorte. &quot;Crítico&quot; significa &quot;perto do topo do que foi carregado&quot;, não violência absoluta
            alta. Para comparar de verdade, use a <strong className="text-indicio">taxa por 100 mil</strong> ou as{" "}
            <strong className="text-indicio">vítimas absolutas</strong>.
          </div>
          <p>
            <strong className="text-ink">&quot;Sem dado&quot;</strong> (a fonte não informou) é distinto de{" "}
            <strong className="text-ink">&quot;zero registrado&quot;</strong> (a fonte informou 0) — eles nunca se
            confundem no mapa.
          </p>
        </div>
      </div>

      {/* radar: as 3 lentes */}
      <div id="radar" className="scroll-mt-24 border-b border-line px-7 py-[26px]">
        <h2 className="mb-3.5 font-mono text-[9.5px] tracking-[.24em] text-quat">O RADAR DE ANOMALIA — TRÊS LENTES</h2>
        <div className="grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-3">
          <div className="bg-panel px-5 py-5">
            <div className="font-mono text-[22px] text-ghost">01</div>
            <h3 className="mt-2 text-[17px] font-[620] [font-stretch:110%]">Ciclo eleitoral</h3>
            <p className="mt-2 text-[12.5px] leading-[1.65] text-ter">
              O homicídio reportado &quot;some&quot; na janela pré-eleitoral? Comparamos cada UF{" "}
              <span className="text-[#C9C7C1]">consigo mesma</span> (índice sazonal ago–out ÷ média do ano) e com os{" "}
              <span className="text-[#C9C7C1]">pares de mesmo porte</span> (diff-in-diff) — nunca ranking cru (IPEA). Só
              vira &quot;forte&quot; cruzado com presença de facção (<em>Review of Economic Studies</em> 86(2), 2018).
            </p>
            <div className="mt-3 font-mono text-[9px] tracking-[.1em] text-quat">SINESP/VDE × MJ/ORCRIM</div>
          </div>
          <div className="bg-panel px-5 py-5">
            <div className="font-mono text-[22px] text-ghost">02</div>
            <h3 className="mt-2 text-[17px] font-[620] [font-stretch:110%]">Governança criminal</h3>
            <p className="mt-2 text-[12.5px] leading-[1.65] text-ter">
              Intensidade de homicídio (homicídios ÷ óbitos totais) relativa à mediana nacional, cruzada com facção.
              Intensidade <span className="text-[#C9C7C1]">atipicamente baixa</span> + facção <em>pode</em> indicar
              controle/&quot;pax&quot; — ou refletir fatores estruturais. Hipótese a investigar, não leitura fechada.
            </p>
            <div className="mt-3 font-mono text-[9px] tracking-[.1em] text-quat">SIM/DATASUS × MJ/ORCRIM · 27 UFs</div>
          </div>
          <div className="bg-panel px-5 py-5">
            <div className="font-mono text-[22px] text-ghost">03</div>
            <h3 className="mt-2 text-[17px] font-[620] [font-stretch:110%]">Homicídios ocultos</h3>
            <p className="mt-2 text-[12.5px] leading-[1.65] text-ter">
              Homicídio (X85–Y09) cai enquanto a <span className="text-[#C9C7C1]">morte por causa indeterminada</span>{" "}
              (Y10–Y34) sobe <span className="text-[#C9C7C1]">acima da tendência nacional</span> — a morte não some,{" "}
              <span className="text-indicio">muda de coluna</span>. Comparação sempre relativa (anti-alarmismo);
              motivação: SciELO 2025 (~43,6% das MVCI seriam homicídios).
            </p>
            <div className="mt-3 font-mono text-[9px] tracking-[.1em] text-quat">SIM/DATASUS · CID X85–Y09 × Y10–Y34</div>
          </div>
        </div>
      </div>

      {/* OSINT pipeline */}
      <div className="grid grid-cols-1 border-b border-line md:grid-cols-2">
        <div className="border-r border-hair px-7 py-[26px]">
          <h2 className="mb-3.5 font-mono text-[9.5px] tracking-[.24em] text-quat">A CAMADA OSINT — PIPELINE</h2>
          <ol className="space-y-2.5 text-[13px] leading-[1.6] text-sec">
            <li>
              <span className="font-mono text-[10px] text-quat">1 · </span>
              <strong className="text-ink">Classificação keyword-first</strong> — palavra-chave decide se é violência
              armada, antes de qualquer IA.
            </li>
            <li>
              <span className="font-mono text-[10px] text-quat">2 · </span>
              <strong className="text-ink">Geocode por dicionário IBGE</strong> — 5.564 municípios, sem LLM (e sem
              confundir bairro/rua homônimo com município).
            </li>
            <li>
              <span className="font-mono text-[10px] text-quat">3 · </span>
              <strong className="text-ink">Dedupe determinístico</strong> — funde notícias do mesmo fato, sem embeddings.
            </li>
            <li>
              <span className="font-mono text-[10px] text-quat">4 · </span>
              <strong className="text-ink">Só então, o LLM</strong> — o restante cai num rodízio de provedores gratuitos.
            </li>
          </ol>
          <p className="mt-3.5 text-[12.5px] leading-[1.65] text-ter">
            No mapa, o indício OSINT é sempre o <span className="text-indicio">◆ losango âmbar</span>, com precisão
            municipal e fonte citada — visivelmente distinto do registro do Fogo Cruzado. Indício, não registro.
          </p>
        </div>
        <div className="px-7 py-[26px]">
          <h2 className="mb-3.5 font-mono text-[9.5px] tracking-[.24em] text-quat">COMO É CONSTRUÍDO</h2>
          <ul className="space-y-2 text-[13px] leading-[1.6] text-sec">
            <li>⚙️ <strong className="text-ink">Next.js + TypeScript</strong> · Tailwind v4 · <strong className="text-ink">MapLibre GL</strong> — sem tile pago.</li>
            <li>🔒 <strong className="text-ink">server-only</strong> + assets versionados — dado pesado fora do bundle.</li>
            <li>🤖 Rodízio de <strong className="text-ink">6 IAs gratuitas</strong> (Gemini · Groq · Cloudflare · Mistral · OpenRouter · Together).</li>
            <li>⏱️ <strong className="text-ink">Cron no GitHub Actions</strong> — ingestão frequente no plano gratuito.</li>
            <li>🛡️ <strong className="text-ink">CSP estrita + Permissions-Policy</strong> — segurança que já pegou bug real.</li>
            <li>✅ node:test · ESLint · Greptile · Snyk · Playwright · <strong className="text-ink">AGPL-3.0</strong>.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
