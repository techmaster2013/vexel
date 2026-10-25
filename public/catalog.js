export const applets = [
  ["YouTube", "▶", "https://www.youtube.com", "#632f3c"],
  ["TikTok", "♪", "https://www.tiktok.com", "#263c46"],
  ["Discord", "◉", "https://discord.com/app", "#414a7d"],
  ["Reddit", "↗", "https://www.reddit.com", "#6b4434"],
  ["Wikipedia", "W", "https://www.wikipedia.org", "#3a4856"],
  ["Bing", "⌕", "https://www.bing.com", "#26544c"],
];
export const toys = [
  ["Orb.Farm", "◌", "https://orb.farm", "A tiny ecosystem in a glass orb."],
  [
    "Radio Garden",
    "◎",
    "https://radio.garden",
    "Explore radio stations around the world.",
  ],
];
// Blender open movies: metadata plus official project links, streams on demand only.
const base = "https://storage.googleapis.com/gtv-videos-bucket/sample/";
export const movies = [
  [
    "bbb",
    "Big Buck Bunny",
    "2008",
    "Comedy",
    "A very large rabbit. Three very small troublemakers.",
    "BigBuckBunny.mp4",
    "https://studio.blender.org/projects/big-buck-bunny/",
    "#60824d",
  ],
  [
    "sintel",
    "Sintel",
    "2010",
    "Fantasy",
    "A young traveler searches for a lost dragon.",
    "Sintel.mp4",
    "https://studio.blender.org/projects/sintel/",
    "#8b584e",
  ],
  [
    "tears",
    "Tears of Steel",
    "2012",
    "Sci-fi",
    "A group of scientists tries to save the world.",
    "TearsOfSteel.mp4",
    "https://studio.blender.org/projects/tears-of-steel/",
    "#445c75",
  ],
  [
    "dream",
    "Elephants Dream",
    "2006",
    "Surreal",
    "Two travelers explore a strange mechanical world.",
    "ElephantsDream.mp4",
    "https://studio.blender.org/projects/elephants-dream/",
    "#776140",
  ],
].map(([id, title, year, category, description, file, source, color]) => ({
  id,
  title,
  year,
  category,
  description,
  stream: base + file,
  source,
  color,
  license: "CC BY 3.0 · Blender Foundation / project contributors",
}));

// Additional onboard catalog records. Streams are activated only after a source check.
movies.push(
  ...[
    [
      "spring",
      "Spring",
      "2019",
      "Fantasy",
      "A shepherd and a small companion explore a changing world.",
      "#5d7857",
    ],
    [
      "charge",
      "Charge",
      "2022",
      "Sci-fi",
      "A chase through a world of mechanical contrasts.",
      "#50606d",
    ],
    [
      "wing-it",
      "Wing It!",
      "2023",
      "Comedy",
      "An inventor prepares for a very unusual flight.",
      "#8a6a4e",
    ],
    [
      "sprite-fright",
      "Sprite Fright",
      "2021",
      "Horror comedy",
      "A forest outing takes a sharp turn. Mature themes.",
      "#657447",
    ],
    [
      "coffee-run",
      "Coffee Run",
      "2020",
      "Experimental",
      "An animated journey through memories and motion.",
      "#975e63",
    ],
    [
      "cosmos-laundromat",
      "Cosmos Laundromat",
      "2015",
      "Fantasy",
      "A strange visitor offers a sheep another chance. Mature themes.",
      "#5c6380",
    ],
    [
      "glass-half",
      "Glass Half",
      "2015",
      "Comedy",
      "A gallery becomes the scene of an unexpected debate.",
      "#648d8e",
    ],
    [
      "hero",
      "Hero",
      "2018",
      "Adventure",
      "A colorful experiment in hand-drawn animation.",
      "#9e714e",
    ],
  ].map(([id, title, year, category, description, color]) => ({
    id,
    title,
    year,
    category,
    description,
    color,
    source: "https://studio.blender.org/projects/" + id + "/",
    license:
      "Catalog metadata only · stream and per-title licensing require verification.",
  })),
);
for (const m of movies) {
  if (m.id === "tears") {
    m.stream = "https://media.xiph.org/tearsofsteel/tears_of_steel_1080p.webm";
    m.license = "CC BY 3.0 · Blender Foundation / Mango Open Movie Project";
  } else {
    delete m.stream;
    if (["bbb", "sintel", "dream"].includes(m.id))
      m.license =
        "CC BY 3.0 · Blender Foundation / project contributors · stream unavailable during verification.";
  }
}

// Verified licensed streaming sources; files remain on the source host.
const openStreams = {
  bbb: "https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4",
  sintel: "https://archive.org/download/Sintel/sintel-2048-stereo_512kb.mp4",
  dream: "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4",
};
for (const m of movies)
  if (openStreams[m.id]) {
    m.stream = openStreams[m.id];
    m.license =
      "CC BY 3.0 · Blender Foundation / project contributors. Full credits retained in the film.";
  }
movies.push({
  id: "llamigos",
  title: "Caminandes: Llamigos",
  year: "2016",
  category: "Comedy",
  description: "Koro the llama faces a stubborn winter problem.",
  color: "#263f65",
  stream:
    "https://archive.org/download/CaminandesLlamigos/Caminandes_%20Llamigos-1080p.mp4",
  source: "https://studio.blender.org/projects/caminandes-llamigos/",
  license:
    "CC BY 3.0 · Blender Foundation / Caminandes project contributors. Full credits retained in the film.",
});
