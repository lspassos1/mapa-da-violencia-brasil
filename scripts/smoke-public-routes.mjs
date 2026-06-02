const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const routes = [
  "/",
  "/metodologia",
  "/api/health",
  "/api/metadata",
  "/api/crime-map",
  "/api/sources/status",
  "/api/municipalities/1200401",
];

for (const route of routes) {
  const response = await fetch(`${baseUrl}${route}`);
  if (!response.ok) {
    throw new Error(`${route} returned HTTP ${response.status}`);
  }
  console.log(`${response.status} ${route}`);
}
