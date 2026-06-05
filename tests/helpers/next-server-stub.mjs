// Stub de next/server para testar route handlers fora do runtime do Next.
// Implementa apenas a superficie usada pelas rotas (NextResponse.json).
export class NextResponse {
  static json(body, init = {}) {
    return {
      status: init.status ?? 200,
      headers: new Headers(init.headers ?? {}),
      _body: body,
      async json() {
        return body;
      },
    };
  }
}
