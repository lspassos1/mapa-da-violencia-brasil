import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { BackLink } from "@/components/layout/BackLink";

export const metadata: Metadata = {
  title: "Metodologia",
  description:
    "Como o Mapa da Violência Brasil separa registro oficial de indício: o mapa da Base VDE, as três lentes do radar de anomalia, a camada OSINT e a stack que sustenta tudo.",
  alternates: { canonical: "/metodologia" },
};

export default function MethodologyPage() {
  return (
    <main className="flex min-h-screen flex-col text-slate-100">
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <BackLink href="/">Voltar ao início</BackLink>

        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">Metodologia</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Como a gente lê (e não lê) os dados</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-300">
            O projeto tem uma regra inegociável: <strong className="text-slate-100">nunca misturar registro oficial com
            indício</strong>. Cada número carrega a sua fonte e a sua ressalva. São três camadas, com fidelidades diferentes —
            e esta página explica o método de cada uma, sem rodeios.
          </p>
        </header>

        {/* As três camadas */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Três camadas, nunca misturadas</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">
              <p className="text-sm font-semibold text-red-200">🔴 Ao vivo</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Tiroteios georreferenciados do <strong>Fogo Cruzado</strong> (4 regiões metropolitanas). Registro, com
                local exato.
              </p>
            </div>
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <p className="text-sm font-semibold text-cyan-200">🗺️ Oficial</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Homicídio doloso da <strong>Base VDE</strong> (SINESP/MJSP), por município. Estatística pública agregada.
              </p>
            </div>
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-4">
              <p className="text-sm font-semibold text-amber-200">🧭 Indício</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Radar de anomalia + camada de notícias (OSINT). <strong>Indício para investigar</strong>, nunca prova nem
                acusação.
              </p>
            </div>
          </div>
        </section>

        {/* Mapa oficial */}
        <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">O mapa oficial</h2>
          <p className="leading-7 text-slate-300">
            A fonte é a <strong>Base VDE do SINESP/MJSP</strong> (carga nacional, 27 UFs e municípios, de 2015 em diante).
            O valor exibido é de <strong>vítimas registradas</strong>, não ocorrências. A taxa por 100 mil usa população
            <strong> IBGE 2025</strong> enquanto a série populacional histórica não é integrada — então comparações entre
            anos pedem essa ressalva.
          </p>
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/5 p-4 text-sm leading-6 text-amber-100">
            <strong>O score 0–100 é posição relativa, não severidade absoluta.</strong> Ele é o <em>percentil</em> do
            município entre os outros carregados naquele período e indicador — recalculado a cada recorte. Ou seja: o mesmo
            município pode ter scores diferentes em datasets diferentes, e &quot;crítico&quot; significa &quot;perto do topo do
            que foi carregado&quot;, não violência absoluta alta. Para comparar de verdade, use a <strong>taxa por 100 mil</strong>{" "}
            ou as <strong>vítimas absolutas</strong>.
          </div>
          <p className="leading-7 text-slate-300">
            A escala tem cinco níveis (baixo · moderado · atenção · alto · crítico). E <strong>&quot;sem dado&quot;</strong>{" "}
            (a fonte não informou) é tratado como distinto de <strong>&quot;zero registrado&quot;</strong> (a fonte informou 0)
            — eles nunca se confundem no mapa.
          </p>
        </section>

        {/* Radar de anomalia */}
        <section id="radar" className="scroll-mt-20 space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">O radar de anomalia — três lentes</h2>
          <p className="leading-7 text-slate-300">
            O radar não acusa ninguém. Ele aponta <strong>onde a estatística oficial pode não estar contando a história
            toda</strong> — cada lente é um jeito diferente de o dado enganar. Tudo aqui é <strong>indício, fundamentado em
            literatura, nunca prova</strong>.
          </p>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-cyan-200">Lente 1 · ciclo eleitoral</h3>
              <p className="mt-1 leading-7 text-slate-300">
                O homicídio reportado &quot;some&quot; na janela pré-eleitoral? Comparamos cada UF{" "}
                <strong>consigo mesma</strong> (índice sazonal ago–out ÷ média do ano, anos de eleição vs normais) e depois
                com os <strong>pares de mesmo porte</strong> (diff-in-diff) — nunca um ranking cru entre estados
                incomparáveis (IPEA). A queda só vira <strong>&quot;indício forte&quot;</strong> quando cruza com presença de
                facção; sozinha, fica &quot;isolada&quot;. Por quê o cruzamento? A literatura (<em>Review of Economic
                Studies</em> 86(2), 2018) mostra que o ciclo eleitoral de homicídios aparece onde há crime organizado.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-cyan-200">Lente 2 · governança criminal</h3>
              <p className="mt-1 leading-7 text-slate-300">
                Medimos a <strong>intensidade de homicídio</strong> (homicídios ÷ óbitos totais, SIM/DATASUS) de cada UF
                relativa à mediana nacional, cruzada com presença de facção (Mapa das Orcrim/MJ 2024). Intensidade{" "}
                <strong>atipicamente baixa</strong> + facção <em>pode</em> indicar controle/&quot;pax&quot; (um grupo domina e
                suprime o confronto) — <strong>ou</strong>, em UFs mais desenvolvidas, refletir fatores{" "}
                <strong>estruturais</strong> (demografia, base de óbitos mais velha). É hipótese a investigar, não leitura
                fechada. Intensidade <strong>alta</strong> + facção sugere <strong>disputa</strong>.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-cyan-200">Lente 3 · homicídios ocultos</h3>
              <p className="mt-1 leading-7 text-slate-300">
                O homicídio (CID-10 X85–Y09) cai enquanto a <strong>&quot;morte por causa indeterminada&quot;</strong> (MVCI,
                Y10–Y34) sobe <strong>acima da tendência nacional</strong>? É a assinatura clássica de reclassificação. A
                comparação é sempre <em>relativa</em> à mediana nacional (não um corte absoluto, que acenderia meio país e
                seria alarmista). Motivação: estudo na SciELO (2025) estima ~43,6% das MVCI como homicídios de fato.
              </p>
            </div>
          </div>
        </section>

        {/* OSINT */}
        <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">A camada OSINT (notícias)</h2>
          <p className="leading-7 text-slate-300">
            Para cobrir o Brasil <strong>fora das 4 metros</strong> do Fogo Cruzado, extraímos indícios de violência armada
            de notícias. A sacada é a ordem do pipeline, pensada para ser barata e honesta:
          </p>
          <ol className="ml-1 space-y-2 text-sm leading-6 text-slate-300">
            <li>
              <strong className="text-slate-100">1. Classificação keyword-first</strong> — palavra-chave decide se é
              violência armada, antes de qualquer IA.
            </li>
            <li>
              <strong className="text-slate-100">2. Geocode por dicionário do IBGE</strong> — resolve a cidade pelos 5.564
              municípios, <em>sem LLM</em> (e sem confundir bairro/rua homônimo com município).
            </li>
            <li>
              <strong className="text-slate-100">3. Dedupe determinístico</strong> — funde notícias do mesmo fato sem
              embeddings.
            </li>
            <li>
              <strong className="text-slate-100">4. Só então, o LLM</strong> — o que sobrou sem geo cai num rodízio de
              provedores gratuitos.
            </li>
          </ol>
          <p className="leading-7 text-slate-300">
            Esse desenho quebrou o teto de ~12 matérias por rodada e levou a cobertura a <strong>nível nacional</strong>.
            No mapa, o indício OSINT é sempre <strong>losango âmbar</strong>, com <strong>precisão municipal</strong> e a
            fonte citada — visivelmente distinto do registro do Fogo Cruzado. Indício, não registro.
          </p>
        </section>

        {/* Stack */}
        <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">Como é construído</h2>
          <ul className="grid gap-2 text-sm leading-6 text-slate-300 sm:grid-cols-2">
            <li>⚙️ <strong>Next.js (App Router) + TypeScript</strong> + Tailwind v4 + <strong>MapLibre GL</strong> — front geoespacial, sem tile pago.</li>
            <li>🔒 <strong>server-only</strong> + assets versionados — dado pesado nunca vai ao bundle do cliente.</li>
            <li>🤖 <strong>Rodízio de 6 IAs gratuitas</strong> (Gemini · Groq · Cloudflare · Mistral · OpenRouter · Together).</li>
            <li>⏱️ <strong>Cron grátis no GitHub Actions</strong> — ingestão frequente sem sair do plano Hobby.</li>
            <li>🛡️ <strong>CSP estrita + Permissions-Policy</strong> — segurança real (foi ela que pegou um bug em produção).</li>
            <li>✅ <strong>node:test · ESLint · Greptile · Snyk · Playwright</strong> — e licença AGPL-3.0.</li>
          </ul>
        </section>

        {/* Responsabilidade */}
        <section className="space-y-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-6">
          <h2 className="text-xl font-semibold text-amber-100">A moldura inegociável</h2>
          <p className="leading-7 text-amber-100/90">
            Indício para investigar, <strong>nunca acusação</strong>; <strong>apartidário</strong>; sempre com a fonte. As
            camadas de notícias e anomalia são indícios, não estatística oficial nem prova — não devem ser usadas para
            vigilância, previsão de crime ou conclusões sobre pessoas ou eventos específicos. Dados oficiais têm
            subnotificação, revisões e diferenças metodológicas entre fontes. E isto <strong>não é alerta de emergência</strong>:
            em urgências, <strong>190</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}
