// Monta data/episodes.json, data/seasons.json e data/characters.json a partir
// das fontes em data/fontes/ e da base escrita à mão em data/base/.
// Rodar com: npm run dados

const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', 'data');
const ler = (arquivo) => JSON.parse(fs.readFileSync(path.join(dataDir, arquivo), 'utf-8'));
const salvar = (arquivo, conteudo) =>
  fs.writeFileSync(path.join(dataDir, arquivo), JSON.stringify(conteudo, null, 2) + '\n');

const tirarHtml = (texto) => (texto || '').replace(/<[^>]+>/g, '').trim() || null;

// Episódios: base do repositório afaf98, completada com resumo, imagem e duração da TVMaze.
// No afaf98, cada posição do array é uma temporada; "nEpisode" é o número geral
// e "nSeason" é o número do episódio dentro da temporada.
// O resumo sai da tradução em data/base/episode-summaries-pt.json; o original em
// inglês da TVMaze só entra se faltar a tradução de algum episódio.
const afafTemporadas = ler('fontes/afaf98-seasons.json');
const tvmazeEpisodios = ler('fontes/tvmaze-episodes.json');
const resumosPt = ler('base/episode-summaries-pt.json');

const episodes = afafTemporadas.flatMap((lista, indice) =>
  lista.map((ep) => {
    const season = indice + 1;
    const tvm = tvmazeEpisodios.find((t) => t.season === season && t.number === ep.nSeason);
    return {
      id: ep.nEpisode,
      title: ep.title,
      season,
      number: ep.nSeason,
      airDate: ep.airDate,
      directedBy: ep.directedBy,
      writtenBy: ep.writtenBy,
      usViewers: ep.USviewers,
      productionCode: ep.productionCode,
      runtime: tvm ? tvm.runtime : null,
      summary: resumosPt[ep.nEpisode] || (tvm ? tirarHtml(tvm.summary) : null),
      image: tvm && tvm.image ? tvm.image.medium : null,
    };
  })
);

// Temporadas: datas e imagem da TVMaze.
const seasons = ler('fontes/tvmaze-seasons.json').map((t) => ({
  id: t.number,
  name: `Temporada ${t.number}`,
  premiereDate: t.premiereDate,
  endDate: t.endDate,
  image: t.image ? t.image.medium : null,
}));

// Personagens: base escrita à mão, com foto da TVMaze e total de episódios do afaf98.
// A foto vem do elenco principal; se não houver, do elenco convidado (juntado dos
// 171 episódios). Sem foto no papel, entra a foto do ator. Quem não está na TVMaze
// ganha a foto da wiki do Fandom (data/fontes/fandom-fotos.json).
const afafPersonagens = ler('fontes/afaf98-characters.json');
const tvmazeElenco = ler('fontes/tvmaze-cast.json');
const tvmazeConvidados = ler('fontes/tvmaze-guestcast.json');
const fandomFotos = ler('fontes/fandom-fotos.json');

// Nomes que a TVMaze escreve de outro jeito no elenco convidado.
const nomeNaTvmaze = {
  'Miranda Gilbert': 'Miranda Sommers-Gilbert',
  'Liz Forbes': 'Sheriff Liz Forbes',
  'Richard Lockwood': 'Mayor Richard Lockwood',
  'Lily Salvatore': 'Lillian "Lily" Salvatore',
  'Meredith Fell': 'Dr. Meredith Fell',
  'Sheila Bennett': 'Sheila "Grams" Bennett',
  'Jo Laughlin': 'Josette "Jo" Laughlin',
  'Liv Parker': 'Olivia "Liv" Parker',
  Anna: 'Anna Zhu',
  Pearl: 'Pearl Zhu',
};

const characters = ler('base/characters.json').map((p) => {
  const afaf = afafPersonagens.find((a) => a.character === p.name);
  const nome = nomeNaTvmaze[p.name] || p.name;
  const principal = tvmazeElenco.find((c) => c.character === p.name && c.image);
  const convidado = tvmazeConvidados.find((c) => c.character === nome);
  const fandom = fandomFotos.find((f) => f.character === p.name);
  const foto = principal
    ? principal.image
    : (convidado && (convidado.image || convidado.actorImage)) || (fandom && fandom.image);
  return {
    ...p,
    image: foto || null,
    episodeCount: afaf ? afaf.episodeCount : null,
  };
});

salvar('episodes.json', episodes);
salvar('seasons.json', seasons);
salvar('characters.json', characters);

console.log(`${episodes.length} episódios, ${seasons.length} temporadas, ${characters.length} personagens.`);
