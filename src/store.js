const KEY = "allez.v1";

export const WEAPONS = [
  { id: "epee", label: "Épée" },
  { id: "fleuret", label: "Fleuret" },
  { id: "sabre", label: "Sabre" },
];

export const CATEGORIES = [
  "M7", "M9", "M11", "M13", "M15", "M17", "M20", "Senior", "Vétéran",
];

export const GENDERS = [
  { id: "H", label: "Hommes" },
  { id: "D", label: "Dames" },
  { id: "M", label: "Mixte" },
];

export const FORMULAS = [
  { id: "poules-tableau", label: "Poules puis tableau" },
  { id: "poules-tous", label: "Poules, tous classés" },
  { id: "tableau", label: "Tableau direct" },
  { id: "deux-tours", label: "Deux tours de poules puis tableau" },
  { id: "equipes-relais", label: "Équipes relais" },
];

const seedNames = {
  H: ["Lucas Bernard","Nathan Petit","Hugo Morel","Enzo Fournier","Adam Garcia","Jules Roux","Louis Michel","Maxime Blanc","Théo Garnier","Aaron Chevalier","Paul Giraud","Antoine Bonnet","Mathis Faure","Gabriele Rossi","Yanis Lefevre"],
  D: ["Léa Martin","Chloé Dubois","Manon Leroy","Inès Moreau","Camille Roux","Emma Laurent","Sarah Nguyen","Clara Fontaine","Jade Picard","Nina Bertrand","Louise Renard","Alice Perrin","Sofia Romano","Agathe Noël","Maya Marchand"],
};

function id(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function buildSeed() {
  const clubs = [
    { id: "c_lyon", name: "CE Lyon Terreaux", city: "Lyon", short: "LYON" },
    { id: "c_vill", name: "AS Villeurbanne Escrime", city: "Villeurbanne", short: "ASV" },
    { id: "c_ven", name: "CE Vénissieux", city: "Vénissieux", short: "VEN" },
    { id: "c_cal", name: "Escrime Club Caluire", city: "Caluire", short: "CAL" },
  ];

  const users = [
    { id: "u_marie", name: "Marie Dupont", role: "organisateur", clubId: "c_lyon", email: "marie@terreaux.fr" },
    { id: "u_julien", name: "Julien Morel", role: "secretariat", clubId: "c_lyon", email: "table@terreaux.fr" },
    { id: "u_lea", name: "Léa Martin", role: "tireur", clubId: "c_lyon", fencerId: "f_lea", email: "lea@mail.fr" },
    { id: "u_sophie", name: "Sophie Martin", role: "parent", clubId: "c_lyon", childIds: ["f_lea"], email: "sophie@mail.fr" },
  ];

  const fencers = [];
  clubs.forEach((club, ci) => {
    for (let i = 0; i < 8; i++) {
      const gender = i < 4 ? "D" : "H";
      const name = pick(seedNames[gender], ci * 8 + i);
      const cat = i % 2 === 0 ? "M15" : "Senior";
      const f = {
        id: ci === 0 && i === 0 && gender === "D" ? "f_lea" : id("f"),
        name: ci === 0 && i === 0 && gender === "D" ? "Léa Martin" : name,
        clubId: club.id,
        gender,
        category: cat,
        weapon: "epee",
        licence: "00" + (100000 + ci * 20 + i),
        ranking: 40 - ci * 5 - i,
      };
      fencers.push(f);
    }
  });

  const events = [
    { id: "e_m15", weapon: "epee", category: "M15", gender: "M", type: "individuel", formula: "poules-tableau", touchesPoule: 5, touchesTableau: 10 },
    { id: "e_sen", weapon: "epee", category: "Senior", gender: "H", type: "individuel", formula: "poules-tableau", touchesPoule: 5, touchesTableau: 15 },
    { id: "e_m13f", weapon: "fleuret", category: "M13", gender: "M", type: "individuel", formula: "poules-tous", touchesPoule: 5, touchesTableau: 8 },
    { id: "e_team", weapon: "epee", category: "Senior", gender: "M", type: "equipes", formula: "equipes-relais", touchesPoule: 5, touchesTableau: 45 },
  ];

  const regs = [];
  fencers.filter((f) => f.weapon === "epee" && f.category === "M15").forEach((f, i) => {
    regs.push({
      id: id("r"),
      tournamentId: "t_rhone",
      eventId: "e_m15",
      fencerId: f.id,
      clubId: f.clubId,
      status: i === fencers.filter(x => x.category==="M15").length - 1 ? "liste-attente" : "inscrit",
      checkedIn: i < 18,
      fee: 12,
      paid: i % 5 !== 0,
    });
  });
  fencers.filter((f) => f.weapon === "epee" && f.category === "Senior" && f.gender === "H").forEach((f) => {
    regs.push({
      id: id("r"),
      tournamentId: "t_rhone",
      eventId: "e_sen",
      fencerId: f.id,
      clubId: f.clubId,
      status: "inscrit",
      checkedIn: false,
      fee: 12,
      paid: true,
    });
  });

  const tournament = {
    id: "t_rhone",
    name: "Open interclubs du Rhône",
    clubId: "c_lyon",
    date: "2026-09-13",
    time: "08:30",
    venue: "Salle Jean Jaurès, Lyon 3e",
    weapons: ["epee", "fleuret"],
    categories: ["M13", "M15", "Senior"],
    fee: 12,
    teamFee: 40,
    deadline: "2026-09-12",
    strips: 6,
    status: "jour-j",
    events,
    season: "2026-2027",
    notes: "Accueil 8h. Arbitres : 1 par club pour 4 tireurs.",
  };

  return {
    clubs,
    users,
    fencers,
    tournaments: [tournament],
    registrations: regs,
    pools: {},
    tableaux: {},
    bouts: [],
    assignments: [],
    results: {},
    seasonPoints: {},
    session: null,
    createdAt: Date.now(),
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const seed = buildSeed();
  saveState(seed);
  return seed;
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(KEY);
  return loadState();
}

export function initials(name = "") {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export { id };
