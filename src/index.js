// API REST de The Vampire Diaries.
// As respostas seguem o formato da SWAPI: listas paginadas com count, next,
// previous e results, e relações entre recursos como URLs.

const express = require('express');
const cors = require('cors');

const characters = require('../data/characters.json');
const episodes = require('../data/episodes.json');
const seasons = require('../data/seasons.json');
const species = require('../data/species.json');
const families = require('../data/families.json');

const PAGE_SIZE = 10;

const app = express();
app.set('trust proxy', true); // na Vercel, req.protocol vem como https
app.use(cors());

// Endereço base de quem chamou, para montar as URLs das relações.
const baseUrl = (req) => `${req.protocol}://${req.get('host')}/api`;

// Compara nomes sem diferenciar maiúsculas nem acentos.
const normalizar = (texto) =>
  String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Cada recurso diz de onde vêm os dados, qual campo é o nome e como vira JSON.
const recursos = {
  characters: {
    dados: characters,
    campoNome: 'name',
    formatar: (p, base) => ({
      ...p,
      species: p.species.map((id) => `${base}/species/${id}`),
      family: p.family ? `${base}/families/${p.family}` : null,
      url: `${base}/characters/${p.id}`,
    }),
  },
  episodes: {
    dados: episodes,
    campoNome: 'title',
    formatar: (e, base) => ({
      ...e,
      season: `${base}/seasons/${e.season}`,
      url: `${base}/episodes/${e.id}`,
    }),
  },
  seasons: {
    dados: seasons,
    campoNome: 'name',
    formatar: (t, base) => {
      const eps = episodes.filter((e) => e.season === t.id);
      return {
        ...t,
        episodeCount: eps.length,
        episodes: eps.map((e) => `${base}/episodes/${e.id}`),
        url: `${base}/seasons/${t.id}`,
      };
    },
  },
  species: {
    dados: species,
    campoNome: 'name',
    formatar: (s, base) => ({
      ...s,
      characters: characters
        .filter((p) => p.species.includes(s.id))
        .map((p) => `${base}/characters/${p.id}`),
      url: `${base}/species/${s.id}`,
    }),
  },
  families: {
    dados: families,
    campoNome: 'name',
    formatar: (f, base) => ({
      ...f,
      characters: characters
        .filter((p) => p.family === f.id)
        .map((p) => `${base}/characters/${p.id}`),
      url: `${base}/families/${f.id}`,
    }),
  },
};

// Raiz: lista os recursos, como a raiz da SWAPI.
app.get(['/', '/api'], (req, res) => {
  const base = baseUrl(req);
  const lista = {};
  for (const nome of Object.keys(recursos)) lista[nome] = `${base}/${nome}`;
  res.json(lista);
});

// Listagem paginada, com filtro opcional por nome: /api/{recurso}?page=2&name=elena
app.get('/api/:recurso', (req, res) => {
  const recurso = recursos[req.params.recurso];
  if (!recurso) return res.status(404).json({ detail: 'Recurso não encontrado' });

  const page = Number(req.query.page ?? 1);
  if (!Number.isInteger(page) || page < 1) {
    return res.status(404).json({ detail: 'Página inválida' });
  }

  let itens = recurso.dados;
  const nome = req.query.name;
  if (nome) {
    const busca = normalizar(nome);
    itens = itens.filter((item) => normalizar(item[recurso.campoNome]).includes(busca));
  }

  const totalPages = Math.max(1, Math.ceil(itens.length / PAGE_SIZE));
  if (page > totalPages) return res.status(404).json({ detail: 'Página não encontrada' });

  const base = baseUrl(req);
  const linkPagina = (n) => {
    const params = new URLSearchParams({ page: String(n) });
    if (nome) params.set('name', nome);
    return `${base}/${req.params.recurso}?${params}`;
  };

  res.json({
    count: itens.length,
    next: page < totalPages ? linkPagina(page + 1) : null,
    previous: page > 1 ? linkPagina(page - 1) : null,
    results: itens
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((item) => recurso.formatar(item, base)),
  });
});

// Detalhe de um item: /api/{recurso}/{id}
app.get('/api/:recurso/:id', (req, res) => {
  const recurso = recursos[req.params.recurso];
  const item = recurso && recurso.dados.find((i) => String(i.id) === req.params.id);
  if (!item) return res.status(404).json({ detail: 'Não encontrado' });
  res.json(recurso.formatar(item, baseUrl(req)));
});

app.use((req, res) => res.status(404).json({ detail: 'Não encontrado' }));

// Localmente, `npm start` sobe o servidor. Na Vercel, o app exportado é usado direto.
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`tvd-api em http://localhost:${port}/api`));
}

module.exports = app;
