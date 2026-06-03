# Placeholders de dados geograficos

Este diretorio fica reservado para assets geograficos leves e versionados.

Evolucao planejada:

1. MVP atual: centroides municipais e bounds simplificados de estados em TypeScript.
2. Proxima etapa: GeoJSON leve de UFs com contornos reais.
3. Depois: poligonos municipais simplificados.
4. Mais tarde: vector tiles ou PMTiles para renderizacao municipal em escala nacional.

Nao commitar shapefiles brutos pesados do IBGE nem pacotes de tiles gerados neste diretorio.

A amostra oficial versionada usa poucos centroides aproximados para validar o contrato do app. A carga nacional app-ready deve receber centroides/bbox derivados da malha IBGE e gravar artefatos grandes apenas em `data/processed/app-ready/`, que fica fora do Git.
