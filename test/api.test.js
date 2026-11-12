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
