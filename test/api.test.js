const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/index.js');

let server;
let base;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://localhost:${server.address().port}/api`;
});

after(() => server.close());

const get = async (caminho) => {
  const res = await fetch(caminho.startsWith('http') ? caminho : base + caminho);
  return { status: res.status, headers: res.headers, body: await res.json() };
};

test('raiz lista os cinco recursos', async () => {
  const { status, body } = await get('');
  assert.equal(status, 200);
  assert.deepEqual(Object.keys(body), ['characters', 'episodes', 'seasons', 'species', 'families']);
});

test('CORS liberado para qualquer origem', async () => {
  const { headers } = await get('/characters');
  assert.equal(headers.get('access-control-allow-origin'), '*');
});

test('respostas ficam em cache na CDN', async () => {
  const { headers } = await get('/characters');
  assert.match(headers.get('cache-control'), /s-maxage=\d+/);
});

test('lista paginada no formato da SWAPI', async () => {
  const { status, body } = await get('/characters');
  assert.equal(status, 200);
  assert.equal(body.count, 49);
  assert.equal(body.results.length, 10);
  assert.equal(body.previous, null);
  assert.match(body.next, /\/api\/characters\?page=2$/);
});

test('seguir next até o fim traz todos os itens, sem repetir', async () => {
  for (const [recurso, total] of [['characters', 49], ['episodes', 171], ['seasons', 8], ['species', 9], ['families', 10]]) {
    let url = base + '/' + recurso;
    const ids = [];
    while (url) {
      const { body } = await get(url);
      ids.push(...body.results.map((i) => i.id));
      url = body.next;
    }
    assert.equal(ids.length, total, recurso);
    assert.equal(new Set(ids).size, total, recurso);
  }
});

test('última página tem previous e não tem next', async () => {
  const { body } = await get('/episodes?page=18');
  assert.equal(body.results.length, 1);
  assert.equal(body.next, null);
  assert.match(body.previous, /page=17$/);
});

test('página fora do intervalo ou inválida responde 404', async () => {
  assert.equal((await get('/characters?page=99')).status, 404);
  assert.equal((await get('/characters?page=0')).status, 404);
  assert.equal((await get('/characters?page=abc')).status, 404);
});

test('busca por nome ignora maiúsculas e acentos e mantém o filtro no next', async () => {
  const { body } = await get('/characters?name=MIKAELSON');
  assert.equal(body.count, 6); // Mikael aparece sem o sobrenome
  const { body: especies } = await get('/species?name=hibrido');
  assert.equal(especies.results[0].name, 'Híbrido');
  const { body: eps } = await get('/episodes?name=the');
  assert.ok(eps.count > 10);
  assert.match(eps.next, /page=2&name=the$/);
});

test('busca sem resultado devolve lista vazia', async () => {
  const { status, body } = await get('/characters?name=xyz');
  assert.equal(status, 200);
  assert.equal(body.count, 0);
  assert.deepEqual(body.results, []);
});

test('detalhe de personagem traz relações como URLs', async () => {
  const { status, body } = await get('/characters/1');
  assert.equal(status, 200);
  assert.equal(body.name, 'Elena Gilbert');
  assert.match(body.family, /\/api\/families\/2$/);
  assert.ok(body.species.every((s) => /\/api\/species\/\d+$/.test(s)));
  assert.equal(body.episodeCount, 134);
  assert.ok(body.image.startsWith('https://'));
});

test('as URLs das relações respondem', async () => {
  const { body } = await get('/characters/11');
  for (const url of [...body.species, body.family]) {
    assert.equal((await get(url)).status, 200, url);
  }
});

test('famílias fundadoras são cinco e listam seus personagens', async () => {
  const { body } = await get('/families');
  const fundadoras = body.results.filter((f) => f.founding).map((f) => f.name);
  assert.deepEqual(fundadoras, ['Salvatore', 'Gilbert', 'Lockwood', 'Forbes', 'Fell']);
  const salvatore = body.results.find((f) => f.name === 'Salvatore');
  assert.ok(salvatore.characters.length >= 3);
});

test('temporada lista seus episódios e episódio aponta para a temporada', async () => {
  const { body: t8 } = await get('/seasons/8');
  assert.equal(t8.episodeCount, 16);
  const { body: ep } = await get(t8.episodes[0].replace(/^.*\/api/, ''));
  assert.match(ep.season, /\/api\/seasons\/8$/);
  assert.equal(ep.number, 1);
});

test('resumos dos episódios estão em português', async () => {
  const { body } = await get('/episodes/1');
  assert.match(body.summary, /^Na estreia da série/);
  const { body: ultimo } = await get('/episodes/171');
  assert.match(ultimo.summary, /Mystic Falls/);
  assert.doesNotMatch(ultimo.summary, /\b(the|and|with)\b/);
});

test('id ou recurso inexistente responde 404', async () => {
  assert.equal((await get('/characters/999')).status, 404);
  assert.equal((await get('/vampiros')).status, 404);
});

// Documentação: /docs, /openapi.json e o contrato contra as respostas reais.

const spec = require('../docs/openapi.json');
const raiz = () => base.replace(/\/api$/, '');

// Validador do pedaço de JSON Schema que o openapi.json usa. Devolve a lista de erros.
const tipoDe = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v);
function validar(valor, schema, caminho = '$') {
  if (schema.$ref) schema = schema.$ref.split('/').slice(1).reduce((o, k) => o[k], spec);
  const erros = [];
  const tipos = [].concat(schema.type);
  const tipo = tipoDe(valor);
  if (!tipos.includes(tipo) && !(tipo === 'integer' && tipos.includes('number'))) {
    return [`${caminho}: esperado ${tipos.join('|')}, veio ${tipo}`];
  }
  if (tipo === 'string' && schema.format === 'uri' && !/^https?:\/\//.test(valor)) erros.push(`${caminho}: não é URL`);
  if (tipo === 'string' && schema.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) erros.push(`${caminho}: não é data`);
  if (tipo === 'array') {
    if (schema.maxItems !== undefined && valor.length > schema.maxItems) erros.push(`${caminho}: mais de ${schema.maxItems} itens`);
    valor.forEach((v, i) => erros.push(...validar(v, schema.items, `${caminho}[${i}]`)));
  }
  if (tipo === 'object') {
    for (const k of schema.required ?? []) if (!(k in valor)) erros.push(`${caminho}.${k}: faltando`);
    for (const [k, v] of Object.entries(valor)) {
      if (schema.properties?.[k]) erros.push(...validar(v, schema.properties[k], `${caminho}.${k}`));
      else if (schema.additionalProperties === false) erros.push(`${caminho}.${k}: campo fora do contrato`);
    }
  }
  return erros;
}

const schemaDe = (caminho, status = 200) => {
  let resposta = spec.paths[caminho].get.responses[status];
  if (resposta.$ref) resposta = resposta.$ref.split('/').slice(1).reduce((o, k) => o[k], spec);
  return resposta.content['application/json'];
};

test('/docs serve o Swagger UI apontando para o /openapi.json', async () => {
  const res = await fetch(raiz() + '/docs');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const html = await res.text();
  assert.match(html, /swagger-ui-dist@\d+\.\d+\.\d+\/swagger-ui-bundle\.js/);
  assert.match(html, /url: '\/openapi\.json'/);
});

test('/openapi.json usa como servidor o endereço de quem chamou', async () => {
  const res = await fetch(raiz() + '/openapi.json');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.openapi, '3.1.0');
  assert.deepEqual(body.servers, [{ url: raiz() }]);
  assert.deepEqual(Object.keys(body.paths), Object.keys(spec.paths));
});

test('o contrato cobre todas as rotas da API, e nada além delas', async () => {
  const { body } = await get('');
  const esperadas = ['/api', ...Object.keys(body).flatMap((r) => [`/api/${r}`, `/api/${r}/{id}`])];
  assert.deepEqual(Object.keys(spec.paths).sort(), esperadas.sort());
});

test('todo item de todo recurso bate com o schema do contrato', async () => {
  const { body: raizApi } = await get('');
  assert.deepEqual(validar(raizApi, schemaDe('/api').schema), []);
  for (const recurso of Object.keys(raizApi)) {
    const schemaLista = schemaDe(`/api/${recurso}`).schema;
    let url = `${base}/${recurso}`;
    while (url) {
      const { body } = await get(url);
      assert.deepEqual(validar(body, schemaLista), [], url);
      url = body.next;
    }
    const { body: item } = await get(`/${recurso}/1`);
    assert.deepEqual(validar(item, schemaDe(`/api/${recurso}/{id}`).schema), [], recurso);
  }
});

test('os exemplos do contrato batem com o schema e com os dados atuais', async () => {
  for (const [caminho, { get: op }] of Object.entries(spec.paths)) {
    const { schema, example, examples } = schemaDe(caminho);
    const exemplos = example ? [example] : Object.values(examples).map((e) => e.value);
    for (const ex of exemplos) {
      assert.deepEqual(validar(ex, schema), [], caminho);
      // O mesmo pedido, feito agora, devolve o mesmo conteúdo do exemplo.
      const id = op.parameters?.find((p) => p.name === 'id')?.example;
      const nome = op.parameters?.find((p) => p.name === 'name')?.example;
      const pedido = caminho.replace('{id}', id) + (nome ? `?name=${encodeURIComponent(nome)}` : '');
      const { body } = await get(pedido.replace(/^\/api/, ''));
      const trocarBase = (v) => JSON.parse(JSON.stringify(v).replaceAll('https://tvd-api.vercel.app/api', base));
      assert.deepEqual(body, trocarBase(ex), pedido);
    }
  }
});

test('os erros 404 seguem o schema Erro', async () => {
  for (const caminho of ['/characters/999', '/vampiros', '/characters?page=0', '/characters?page=99']) {
    const { status, body } = await get(caminho);
    assert.equal(status, 404);
    assert.deepEqual(validar(body, { $ref: '#/components/schemas/Erro' }), [], caminho);
  }
});
