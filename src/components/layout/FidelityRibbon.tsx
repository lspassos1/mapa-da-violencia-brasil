// Ribbon de fidelidade (34px) — sempre visível sob o header. Declara as três
// camadas do produto e a regra editorial: as camadas NUNCA se misturam.
// Estático (server component); rolagem horizontal em telas estreitas.
export function FidelityRibbon() {
  return (
    <div className="flex h-[34px] items-center overflow-x-auto whitespace-nowrap border-b border-hair bg-panel font-mono text-[9.5px] tracking-[.1em] text-[#6C717A]">
      <div className="flex h-full flex-none items-center gap-2 border-r border-hair px-5">
        <span className="h-[7px] w-[7px] flex-none rounded-full bg-registro" />
        <span>
          <span className="text-sec">REGISTRO</span> — FOGO CRUZADO · GEOLOCALIZADO
        </span>
      </div>
      <div className="flex h-full flex-none items-center gap-2 border-r border-hair px-5">
        <span className="h-[7px] w-[7px] flex-none rotate-45 border border-indicio" />
        <span>
          <span className="text-sec">INDÍCIO</span> — NOTÍCIAS/OSINT · PRECISÃO MUNICIPAL
        </span>
      </div>
      <div className="flex h-full flex-none items-center gap-2 border-r border-hair px-5">
        <span className="h-[7px] w-[7px] flex-none bg-quat" />
        <span>
          <span className="text-sec">OFICIAL</span> — SINESP/MJSP · AGREGADO MENSAL
        </span>
      </div>
      <div className="ml-auto flex-none px-5 text-quat">INDÍCIO ≠ ESTATÍSTICA OFICIAL — AS CAMADAS NUNCA SE MISTURAM</div>
    </div>
  );
}
