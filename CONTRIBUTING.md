# Contribuindo

Obrigado por considerar contribuir com o Mapa da Violencia Brasil.

## Instalar

```bash
npm install
```

## Rodar localmente

```bash
npm run dev
```

A aplicacao fica disponivel em:

```txt
http://localhost:3000
```

## Validar antes de enviar mudancas

```bash
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
```

## Padrao de branch

Use branches pequenas e descritivas:

```txt
codex/nome-curto-da-tarefa
feat/nome-curto-da-tarefa
fix/nome-curto-da-correcao
docs/nome-curto-da-documentacao
```

## Padrao de commit

Prefira Conventional Commits:

```txt
docs(project): update public documentation
feat(map): add municipality search
fix(api): validate indicator parameter
refactor(data): isolate mock service
```

## Dados e privacidade

- Nao adicione dados pessoais.
- Nao adicione microdados individuais de ocorrencias.
- Nao adicione enderecos, coordenadas de ocorrencias ou qualquer dado que permita identificar vitimas, autores ou eventos especificos.
- Prefira sempre dados agregados por municipio, periodo e indicador.
- Registre fonte, URL, periodo, orgao responsavel e observacoes de licenca/uso.

## Escopo atual

A versao atual usa dados demonstrativos. A proxima fase tecnica deve integrar dados reais primeiro em modo offline/local, antes de conectar banco de producao ou automacoes.
