# tvd-api

API REST de The Vampire Diaries, feita para o Projeto Prático de Interfaces Web (IFSP). As respostas
seguem o formato da [SWAPI](https://swapi.dev): listas paginadas com `count`, `next`, `previous` e
`results`, e relações entre recursos como URLs.

**No ar em https://tvd-api.vercel.app/api**

## Recursos

| Rota | O que traz | Itens |
|---|---|---|
| `GET /api` | Lista os recursos | |
| `GET /api/characters` | Personagens: ator, espécies, família, descrição, foto e total de episódios | 49 |
| `GET /api/episodes` | Episódios: temporada, número, data, direção, roteiro, audiência, resumo e imagem | 171 |
| `GET /api/seasons` | Temporadas: datas, imagem e lista de episódios | 8 |
| `GET /api/species` | Espécies: humano, vampiro, Original, lobisomem, híbrido, bruxa, herege, doppelgänger e imortal | 9 |
| `GET /api/families` | Famílias, com `founding: true` nas cinco fundadoras de Mystic Falls | 10 |

Cada recurso também tem o detalhe por id: `GET /api/characters/1`.

### Parâmetros

- `?page=N`: página da lista, com 10 itens por página. Página inexistente responde 404.
- `?name=texto`: filtra pelo nome (ou pelo título, nos episódios), sem diferenciar maiúsculas nem acentos.

### Exemplo

```js
// Busca todas as páginas de personagens, seguindo o "next"
async function buscarTodos(url) {
  const itens = [];
  while (url) {
    const resposta = await fetch(url);
    const pagina = await resposta.json();
    itens.push(...pagina.results);
    url = pagina.next;
  }
  return itens;
}
```

## Rodar localmente

```bash
npm install
npm start      # http://localhost:3000/api
npm test       # testes com node:test
```

## Dados

- `data/fontes/`: dados de origem, guardados como vieram.
  - `afaf98-*.json`: do projeto [afaf98/Vampire_diaries_API](https://github.com/afaf98/Vampire_diaries_API), base dos episódios e do total de episódios por personagem.
  - `tvmaze-*.json`: da [TVMaze](https://www.tvmaze.com/api) (licença CC BY-SA), com resumos, imagens, durações e fotos do elenco.
- `data/base/characters.json`, `data/species.json` e `data/families.json`: escritos à mão.
- `data/base/episode-summaries-pt.json`: resumos dos 171 episódios traduzidos para o português a partir dos textos da TVMaze. Como tradução de conteúdo CC BY-SA, seguem na mesma licença, com crédito à TVMaze.
- `npm run dados` junta as fontes e gera `data/characters.json`, `data/episodes.json` e `data/seasons.json`.

## Deploy

Publicada na Vercel como app Express: `src/index.js` exporta o app. Cada push na `main` gera um deploy de produção.
