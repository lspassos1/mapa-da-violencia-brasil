import Link from "next/link";

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
            Esta versao usa dados demonstrativos para validar a experiencia visual. Os valores nao
            representam ocorrencias oficiais e nao devem ser usados para conclusoes sobre municipios.
          </p>
        </header>

        <section className="space-y-4 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold">O que o mapa mostra</h2>
          <p className="leading-7 text-slate-300">
            O MVP mostra municipios selecionados por centroide, com score de 0 a 100, filtros por
            indicador e modos de visualizacao. A arquitetura esta preparada para receber dados
            oficiais agregados por municipio, mes e indicador.
          </p>
        </section>

        <section className="space-y-4 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold">Como ler os scores</h2>
          <p className="leading-7 text-slate-300">
            A escala demonstrativa usa cinco niveis: baixo, moderado, atencao, alto e critico. Em
            producao, a taxa por 100 mil habitantes deve ser priorizada para evitar comparar cidades
            apenas pelo volume absoluto de registros.
          </p>
        </section>

        <section className="space-y-4 rounded-lg border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-semibold">Responsabilidade</h2>
          <p className="leading-7 text-slate-300">
            O produto deve usar linguagem de incidencia registrada e nivel do indicador. Dados
            oficiais podem ter subnotificacao, revisoes e diferencas metodologicas entre fontes. O
            mapa nao mede risco individual em tempo real.
          </p>
        </section>
      </div>
    </main>
  );
}

