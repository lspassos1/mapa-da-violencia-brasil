import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { BackLink } from "@/components/layout/BackLink";

export const metadata: Metadata = {
  title: "Metodologia",
  description:
    "Como o Mapa da Violência Brasil trata fontes oficiais, indicadores e limitações dos dados.",
  alternates: { canonical: "/metodologia" },
};

export default function MethodologyPage() {
  return (
    <main className="flex min-h-screen flex-col text-slate-100">
      <AppHeader />
      <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-8 sm:px-6 sm:py-10">
        <BackLink href="/">Voltar para o mapa</BackLink>

        <header className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-300">Metodologia</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Mapa da Violência Brasil</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-300">
            Esta versão inicia a transição para dados oficiais agregados. A camada principal usa uma
            amostra versionada do SINESP/MJSP para homicídio doloso municipal, medida em vítimas, e
            mantém avisos claros até a carga nacional completa ser publicada.
          </p>
        </header>

        <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">O que o mapa mostra</h2>
          <p className="leading-7 text-slate-300">
            O mapa mostra municípios por centroide, com score de 0 a 100, filtros por indicador e
            modos de visualização. O primeiro recorte oficial é homicídio doloso do SINESP/MJSP; o
            valor exibido representa vítimas registradas, não ocorrências.
          </p>
          <p className="leading-7 text-slate-300">
            A taxa por 100 mil habitantes usa população IBGE 2025 enquanto a série populacional
            histórica não estiver integrada. Comparações históricas devem ser lidas com essa
            limitação metodológica.
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">Como ler os scores</h2>
          <p className="leading-7 text-slate-300">
            A escala usa cinco níveis: baixo, moderado, atenção, alto e crítico. Para indicadores
            individuais, a taxa por 100 mil habitantes deve ser priorizada para evitar comparar
            municípios apenas pelo volume absoluto de registros.
          </p>
          <p className="leading-7 text-slate-300">
            Municípios sem dado informado pela fonte devem aparecer como sem dados. Isso é diferente
            de zero registrado, que significa que a fonte informou explicitamente valor 0.
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-xl font-semibold">Responsabilidade</h2>
          <p className="leading-7 text-slate-300">
            O produto deve usar linguagem de incidência registrada e nível do indicador. Dados
            oficiais podem ter subnotificação, revisões e diferenças metodológicas entre fontes. O
            mapa não mede risco individual em tempo real e não deve ser usado para vigilância,
            previsão de crime ou conclusões sobre eventos individuais.
          </p>
        </section>
      </div>
    </main>
  );
}
