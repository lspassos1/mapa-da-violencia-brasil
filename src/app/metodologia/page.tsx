import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Metodologia",
  description:
    "Como o Mapa da Violencia Brasil trata fontes oficiais, indicadores e limitacoes dos dados.",
  alternates: { canonical: "/metodologia" },
};

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-8">
        <Link className="text-sm font-semibold text-cyan-300 hover:text-cyan-200" href="/">
          Voltar para o mapa
        </Link>
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.18em] text-cyan-300">Metodologia</p>
          <h1 className="text-4xl font-semibold">Mapa da Violencia Brasil</h1>
          <p className="max-w-3xl text-base leading-7 text-slate-300">
            Esta versao inicia a transicao para dados oficiais agregados. A camada principal usa uma
            amostra versionada do SINESP/MJSP para homicidio doloso municipal, medida em vitimas, e
            mantem avisos claros ate a carga nacional completa ser publicada.
          </p>
        </header>

        <section className="space-y-4 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold">O que o mapa mostra</h2>
          <p className="leading-7 text-slate-300">
            O mapa mostra municipios por centroide, com score de 0 a 100, filtros por indicador e
            modos de visualizacao. O primeiro recorte oficial e homicidio doloso do SINESP/MJSP; o
            valor exibido representa vitimas registradas, nao ocorrencias.
          </p>
          <p className="leading-7 text-slate-300">
            A taxa por 100 mil habitantes usa populacao IBGE 2025 enquanto a serie populacional
            historica nao estiver integrada. Comparacoes historicas devem ser lidas com essa
            limitacao metodologica.
          </p>
        </section>

        <section className="space-y-4 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold">Como ler os scores</h2>
          <p className="leading-7 text-slate-300">
            A escala usa cinco niveis: baixo, moderado, atencao, alto e critico. Para indicadores
            individuais, a taxa por 100 mil habitantes deve ser priorizada para evitar comparar
            municipios apenas pelo volume absoluto de registros.
          </p>
          <p className="leading-7 text-slate-300">
            Municipios sem dado informado pela fonte devem aparecer como sem dados. Isso e diferente
            de zero registrado, que significa que a fonte informou explicitamente valor 0.
          </p>
        </section>

        <section className="space-y-4 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold">Responsabilidade</h2>
          <p className="leading-7 text-slate-300">
            O produto deve usar linguagem de incidencia registrada e nivel do indicador. Dados
            oficiais podem ter subnotificacao, revisoes e diferencas metodologicas entre fontes. O
            mapa nao mede risco individual em tempo real e nao deve ser usado para vigilancia,
            previsao de crime ou conclusoes sobre eventos individuais.
          </p>
        </section>
      </div>
    </main>
  );
}

