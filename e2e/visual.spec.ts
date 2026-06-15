import { test, expect, type Page, type ConsoleMessage } from "@playwright/test";

// Erros de carregamento de recursos externos (tiles do mapa, favicon, etc.) e
// ruido conhecido NAO devem quebrar a checagem visual — so erros REAIS de JS
// (pageerror) e console.error da aplicacao.
// So ruido de REDE/recurso externo e benigno conhecido. NAO ignorar "maplibre"
// em geral — erros reais do mapa (ex.: crash de render) devem quebrar o teste;
// falhas de tile sao cobertas pelos padroes de rede abaixo.
const IGNORAR = [
  /tile/i,
  /net::/i,
  /Failed to load resource/i,
  /ERR_/i,
  /ResizeObserver/i,
  /favicon/i,
  /React DevTools/i,
];

function rastrearErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(`pageerror: ${e.message}`));
  page.on("console", (m: ConsoleMessage) => {
    if (m.type() === "error" && !IGNORAR.some((re) => re.test(m.text()))) {
      erros.push(`console.error: ${m.text()}`);
    }
  });
  return erros;
}

// Mock do payload OSINT: evita disparar IA (deterministico e sem custo de quota).
const MOCK_NEWS = {
  incidents: [
    {
      id: "mock-1",
      tipo: "homicidio",
      municipio: "São Paulo",
      uf: "SP",
      idIbge: "3550308",
      lat: -23.55,
      lng: -46.63,
      vitimas: 1,
      dataOcorrencia: "2026-06-15",
      resumo: "Incidente de teste para a verificação visual.",
      fontes: [
        { fonteUrl: "https://exemplo.com/1", veiculo: "G1", provedor: "groq", confianca: 0.9, titulo: "t", publicadoEm: null },
      ],
      corroboracao: 1,
      fonteUrl: "https://exemplo.com/1",
      veiculo: "G1",
      provedor: "groq",
      confianca: 0.9,
      reviewStatus: "confirmado",
      extraidoEm: "2026-06-15T00:00:00.000Z",
    },
  ],
  meta: {
    disclaimer: "INDÍCIOS extraídos de notícias por IA — verificação visual (mock).",
    official: false,
    stats: { artigos: 1, extraidos: 1, descartados: 0, deduplicados: 0, fontesTotais: 1, incidentesMultiFonte: 0, porProvedor: { groq: 1 }, provedores: 6 },
    geradoEm: "2026-06-15T00:00:00.000Z",
  },
};

test("/ — mapa, ranking e conteudo renderizam", async ({ page }, testInfo) => {
  const erros = rastrearErros(page);
  const resp = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(resp?.ok(), "GET / deve responder 2xx").toBeTruthy();

  // Titulo do dashboard.
  await expect(page.getByRole("heading", { name: /Mapa da Viol[eê]ncia Brasil/i })).toBeVisible();

  // Mapa renderiza: canvas do MapLibre presente e com area > 0 (nao vazio/crashado).
  const canvas = page.locator("canvas.maplibregl-canvas").first();
  await expect(canvas).toBeVisible({ timeout: 25_000 });
  const box = await canvas.boundingBox();
  expect(box && box.width > 100 && box.height > 100, "canvas do mapa deve ter area").toBeTruthy();

  // Ranking aparece (Top 10 piores).
  await expect(page.getByText(/10 piores/i).first()).toBeVisible();

  // Banner de modo de dados: so existe em amostra/demo (null no modo official) —
  // se presente, deve estar visivel; sua ausencia no modo official nao falha.
  const banner = page.getByText(/Amostra oficial|Dados demonstrativos/).first();
  if (await banner.count()) await expect(banner).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("home.png") });
  expect(erros, `erros de console/JS:\n${erros.join("\n")}`).toEqual([]);
});

test("/metodologia — pagina renderiza", async ({ page }) => {
  const erros = rastrearErros(page);
  const resp = await page.goto("/metodologia", { waitUntil: "domcontentloaded" });
  expect(resp?.ok(), "GET /metodologia deve responder 2xx").toBeTruthy();
  await expect(page.getByRole("heading", { name: /Mapa da Viol[eê]ncia Brasil/i })).toBeVisible();
  await expect(page.getByText(/Metodologia/i).first()).toBeVisible();
  expect(erros, `erros de console/JS:\n${erros.join("\n")}`).toEqual([]);
});

test("/noticias — aba OSINT renderiza (API mockada, sem IA)", async ({ page }, testInfo) => {
  const erros = rastrearErros(page);
  await page.route("**/api/news-incidents**", (route) => route.fulfill({ json: MOCK_NEWS }));

  const resp = await page.goto("/noticias", { waitUntil: "domcontentloaded" });
  expect(resp?.ok(), "GET /noticias deve responder 2xx").toBeTruthy();

  // Banner inegociavel "indicio, nao oficial".
  await expect(page.getByText(/Indícios extraídos de notícias/i)).toBeVisible();
  // Card do incidente mockado (resumo unico — evita casar com a <option> do filtro).
  await expect(page.getByText(/Incidente de teste para a verificação visual/i)).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("noticias.png") });
  expect(erros, `erros de console/JS:\n${erros.join("\n")}`).toEqual([]);
});
