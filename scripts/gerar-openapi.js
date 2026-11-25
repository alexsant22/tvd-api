// Gera docs/openapi.json: o contrato OpenAPI da API, com exemplos tirados da
// própria API. Rodar com: npm run docs
// Os textos e os schemas ficam aqui; os exemplos saem dos dados atuais. Depois de
// mudar os dados (npm run dados) ou um campo da API, rodar de novo e conferir com npm test.

const path = require('node:path');
const fs = require('node:fs');

const repo = path.join(__dirname, '..');
const destino = path.join(repo, 'docs', 'openapi.json');
const PROD = 'https://tvd-api.vercel.app';

// O app carrega o docs/openapi.json para servir em /openapi.json. Se o arquivo
// sumiu ou quebrou, um contrato vazio no lugar deixa o app subir para gerar o novo.
try {
  JSON.parse(fs.readFileSync(destino, 'utf-8'));
} catch {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, '{}\n');
}
const app = require(path.join(repo, 'src', 'index.js'));

const uri = (descricao) => ({ type: 'string', format: 'uri', description: descricao });
const naoEncontrado = { $ref: '#/components/responses/NaoEncontrado' };

const schemas = {
  Character: {
    type: 'object',
    description: 'Personagem da série.',
    properties: {
      id: { type: 'integer', description: 'Identificador do personagem.' },
      name: { type: 'string', description: 'Nome do personagem.' },
      actor: { type: 'string', description: 'Ator ou atriz que interpreta o personagem.' },
      species: { type: 'array', items: uri('URL de uma espécie.'), description: 'Espécies do personagem, na ordem em que ele passou por elas na série.' },
      family: { type: ['string', 'null'], format: 'uri', description: 'URL da família, ou null quando o personagem não pertence a uma família cadastrada.' },
      description: { type: 'string', description: 'Quem é o personagem, em português.' },
      image: { type: ['string', 'null'], format: 'uri', description: 'Foto do ator no papel (TVMaze); sem ela, a foto do ator. null quando não há nenhuma.' },
      episodeCount: { type: ['integer', 'null'], description: 'Em quantos episódios o personagem aparece, ou null quando a fonte não informa.' },
      url: uri('Endereço deste personagem na API.'),
    },
  },
  Episode: {
    type: 'object',
    description: 'Episódio da série.',
    properties: {
      id: { type: 'integer', description: 'Identificador do episódio, de 1 a 171 na ordem de exibição.' },
      title: { type: 'string', description: 'Título original, em inglês.' },
      season: uri('URL da temporada do episódio.'),
      number: { type: 'integer', description: 'Número do episódio dentro da temporada.' },
      airDate: { type: 'string', format: 'date', description: 'Data de exibição nos Estados Unidos (AAAA-MM-DD).' },
      directedBy: { type: 'string', description: 'Direção.' },
      writtenBy: { type: 'string', description: 'Roteiro, como aparece nos créditos.' },
      usViewers: { type: 'number', description: 'Audiência nos Estados Unidos, em milhões de espectadores.' },
      productionCode: { type: 'string', description: 'Código de produção.' },
      runtime: { type: 'integer', description: 'Duração em minutos.' },
      summary: { type: 'string', description: 'Resumo em português, traduzido da TVMaze (CC BY-SA).' },
      image: uri('Imagem do episódio (TVMaze).'),
      url: uri('Endereço deste episódio na API.'),
    },
  },
  Season: {
    type: 'object',
    description: 'Temporada da série.',
    properties: {
      id: { type: 'integer', description: 'Número da temporada, de 1 a 8.' },
      name: { type: 'string', description: 'Nome da temporada.' },
      premiereDate: { type: 'string', format: 'date', description: 'Data de estreia (AAAA-MM-DD).' },
      endDate: { type: 'string', format: 'date', description: 'Data do último episódio (AAAA-MM-DD).' },
      image: uri('Pôster da temporada (TVMaze).'),
      episodeCount: { type: 'integer', description: 'Quantidade de episódios da temporada.' },
      episodes: { type: 'array', items: uri('URL de um episódio.'), description: 'Episódios da temporada, em ordem.' },
      url: uri('Endereço desta temporada na API.'),
    },
  },
  Species: {
    type: 'object',
    description: 'Espécie sobrenatural (ou humana) do universo da série.',
    properties: {
      id: { type: 'integer', description: 'Identificador da espécie.' },
      name: { type: 'string', description: 'Nome da espécie, em português.' },
      description: { type: 'string', description: 'O que caracteriza a espécie.' },
      characters: { type: 'array', items: uri('URL de um personagem.'), description: 'Personagens que são ou foram dessa espécie.' },
      url: uri('Endereço desta espécie na API.'),
    },
  },
  Family: {
    type: 'object',
    description: 'Família de Mystic Falls ou ligada à história.',
    properties: {
      id: { type: 'integer', description: 'Identificador da família.' },
      name: { type: 'string', description: 'Sobrenome da família.' },
      founding: { type: 'boolean', description: 'true nas cinco famílias fundadoras de Mystic Falls.' },
      description: { type: 'string', description: 'Quem é a família na série.' },
      characters: { type: 'array', items: uri('URL de um personagem.'), description: 'Personagens da família.' },
      url: uri('Endereço desta família na API.'),
    },
  },
  Erro: {
    type: 'object',
    description: 'Corpo de toda resposta de erro.',
    properties: { detail: { type: 'string', description: 'Motivo do erro.' } },
  },
};

for (const s of Object.values(schemas)) {
  s.required = Object.keys(s.properties);
  s.additionalProperties = false;
}

const lista = (nome) => ({
  type: 'object',
  description: `Página de ${nome}, no formato da SWAPI.`,
  properties: {
    count: { type: 'integer', description: 'Total de itens que atendem à busca, somando todas as páginas.' },
    next: { type: ['string', 'null'], format: 'uri', description: 'URL da próxima página, ou null na última.' },
    previous: { type: ['string', 'null'], format: 'uri', description: 'URL da página anterior, ou null na primeira.' },
    results: { type: 'array', maxItems: 10, items: { $ref: `#/components/schemas/${nome}` }, description: 'Até 10 itens.' },
  },
  required: ['count', 'next', 'previous', 'results'],
  additionalProperties: false,
});

const recursos = [
  { rota: 'characters', schema: 'Character', tag: 'Personagens', plural: 'personagens', total: 49, campo: 'name', listaEx: 'name=salvatore', id: 1 },
  { rota: 'episodes', schema: 'Episode', tag: 'Episódios', plural: 'episódios', total: 171, campo: 'title', listaEx: 'name=pilot', id: 1 },
  { rota: 'seasons', schema: 'Season', tag: 'Temporadas', plural: 'temporadas', total: 8, campo: 'name', listaEx: 'name=temporada 8', id: 8 },
  { rota: 'species', schema: 'Species', tag: 'Espécies', plural: 'espécies', total: 9, campo: 'name', listaEx: 'name=lobisomem', id: 4 },
  { rota: 'families', schema: 'Family', tag: 'Famílias', plural: 'famílias', total: 10, campo: 'name', listaEx: 'name=salvatore', id: 1 },
];

async function main() {
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const local = `http://localhost:${server.address().port}`;
  const buscar = async (caminho) => {
    const res = await fetch(local + caminho);
    const texto = (await res.text()).replaceAll(local, PROD);
    return JSON.parse(texto);
  };

  const paths = {
    '/api': {
      get: {
        tags: ['Raiz'],
        summary: 'Lista os recursos',
        description: 'Ponto de partida da API: devolve a URL de cada recurso.',
        operationId: 'raiz',
        responses: {
          200: {
            description: 'URL de cada recurso.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: Object.fromEntries(recursos.map((r) => [r.rota, uri(`URL da lista de ${r.plural}.`)])),
                  required: recursos.map((r) => r.rota),
                  additionalProperties: false,
                },
                example: await buscar('/api'),
              },
            },
          },
        },
      },
    },
  };

  for (const r of recursos) {
    const [pchave, pvalor] = r.listaEx.split('=');
    paths[`/api/${r.rota}`] = {
      get: {
        tags: [r.tag],
        summary: `Lista ${r.plural}`,
        description: `Lista paginada de ${r.plural}: ${r.total} no total, 10 por página. Para trazer a lista inteira, siga \`next\` até ele vir null.`,
        operationId: `listar_${r.rota}`,
        parameters: [
          { $ref: '#/components/parameters/page' },
          {
            name: 'name',
            in: 'query',
            required: false,
            description: r.campo === 'title'
              ? 'Filtra pelo título do episódio. Busca por trecho, sem diferenciar maiúsculas nem acentos. O filtro continua nos links `next` e `previous`.'
              : 'Filtra pelo nome. Busca por trecho, sem diferenciar maiúsculas nem acentos. O filtro continua nos links `next` e `previous`.',
            schema: { type: 'string' },
            example: pvalor,
          },
        ],
        responses: {
          200: {
            description: 'Página da lista. Busca sem resultado também responde 200, com `count` 0 e `results` vazio.',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/Lista${r.schema}` },
                examples: {
                  [`busca_${pvalor.replace(/\s/g, '_')}`]: {
                    summary: `GET /api/${r.rota}?${pchave}=${pvalor}`,
                    value: await buscar(`/api/${r.rota}?${pchave}=${encodeURIComponent(pvalor)}`),
                  },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/PaginaInvalida' },
        },
      },
    };
    paths[`/api/${r.rota}/{id}`] = {
      get: {
        tags: [r.tag],
        summary: `Detalhe de ${r.schema === 'Character' ? 'um personagem' : r.schema === 'Episode' ? 'um episódio' : r.schema === 'Season' ? 'uma temporada' : r.schema === 'Species' ? 'uma espécie' : 'uma família'}`,
        operationId: `detalhar_${r.rota}`,
        parameters: [
          { name: 'id', in: 'path', required: true, description: 'Identificador numérico.', schema: { type: 'integer', minimum: 1 }, example: r.id },
        ],
        responses: {
          200: {
            description: 'O item pedido.',
            content: {
              'application/json': {
                schema: { $ref: `#/components/schemas/${r.schema}` },
                example: await buscar(`/api/${r.rota}/${r.id}`),
              },
            },
          },
          404: naoEncontrado,
        },
      },
    };
    schemas[`Lista${r.schema}`] = lista(r.schema);
  }

  server.close();

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'tvd-api',
      version: require(path.join(repo, 'package.json')).version,
      description: [
        'API REST de **The Vampire Diaries**, aberta e somente leitura, sem autenticação e com CORS liberado.',
        '',
        'As respostas seguem o formato da [SWAPI](https://swapi.dev): listas paginadas com `count`, `next`, `previous` e `results`, e relações entre recursos como URLs. Para pegar a família de um personagem, por exemplo, basta fazer um GET na URL do campo `family`.',
        '',
        'Descrições, espécies e resumos dos episódios estão em português. Títulos dos episódios e créditos ficam no original.',
        '',
        'Fontes: [afaf98/Vampire_diaries_API](https://github.com/afaf98/Vampire_diaries_API) e [TVMaze](https://www.tvmaze.com/api) (CC BY-SA), mais dados escritos à mão. A foto da Tatia Petrova vem da [The Vampire Diaries Wiki](https://vampirediaries.fandom.com/wiki/Tatia).',
      ].join('\n'),
      license: { name: 'Resumos e imagens: CC BY-SA 4.0 (TVMaze)', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
    },
    externalDocs: { description: 'Código no GitHub', url: 'https://github.com/alexsant22/tvd-api' },
    servers: [{ url: PROD, description: 'Produção (Vercel)' }],
    tags: [
      { name: 'Raiz', description: 'Ponto de partida.' },
      ...recursos.map((r) => ({ name: r.tag, description: `${r.total} ${r.plural}.` })),
    ],
    paths,
    components: {
      schemas,
      parameters: {
        page: {
          name: 'page',
          in: 'query',
          required: false,
          description: 'Número da página, a partir de 1. Cada página traz até 10 itens.',
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
      },
      responses: {
        NaoEncontrado: {
          description: 'Recurso ou id inexistente.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' }, example: { detail: 'Não encontrado' } } },
        },
        PaginaInvalida: {
          description: 'Página que não é um inteiro a partir de 1, ou que passa da última.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Erro' },
              examples: {
                invalida: { summary: '?page=0 ou ?page=abc', value: { detail: 'Página inválida' } },
                alem_da_ultima: { summary: '?page=99', value: { detail: 'Página não encontrada' } },
              },
            },
          },
        },
      },
    },
  };

  fs.writeFileSync(destino, JSON.stringify(spec, null, 2) + '\n');
  console.log(`docs/openapi.json gerado: ${Object.keys(paths).length} rotas, ${Object.keys(schemas).length} schemas.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
