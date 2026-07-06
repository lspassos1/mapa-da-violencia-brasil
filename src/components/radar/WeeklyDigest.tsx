"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface DigestPayload {
  texto?: string;
  provedor?: string;
  geradoEm?: string;
  fontes?: string[];
  semana?: string;
  sinais?: { eleitorais: number; governanca: number };
  aviso?: string;
}

// Busca o digest semanal (gerado por IA) e renderiza com a moldura de indício.
// Client-side p/ não bloquear o render do /radar com a chamada de IA.
export function WeeklyDigest() {
  const [data, setData] = useState<DigestPayload | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/anomaly-digest")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => active && setData(j as DigestPayload))
      .catch(() => active && setErro(true));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mt-6 rounded-xl border border-line bg-panel p-4">
      <div className="mb-2 flex items-center gap-2 text-sec">
        <Sparkles className="h-4 w-4" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">Digest semanal (IA)</h3>
        {data?.semana ? <span className="text-xs text-quat">· {data.semana}</span> : null}
      </div>

      {!data && !erro ? <p className="text-sm text-ter">A gerar resumo…</p> : null}
      {erro ? <p className="text-sm text-quat">Digest indisponível no momento.</p> : null}
      {data?.aviso ? <p className="text-sm text-quat">{data.aviso}</p> : null}

      {data?.texto ? (
        <>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{data.texto}</p>
          <p className="mt-3 text-[11px] text-quat">
            Gerado por IA ({data.provedor}) a partir das lentes do radar — <strong>indício, não acusação</strong>.{" "}
            {data.fontes?.length ? `Fontes: ${data.fontes.join("; ")}.` : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}
