function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function poolSizes(n) {
  if (n <= 1) return [n];
  if (n <= 7) return [n];
  const sizes = [];
  let left = n;
  while (left > 0) {
    if (left === 8) { sizes.push(4, 4); break; }
    if (left >= 7 && left % 7 !== 1) { sizes.push(7); left -= 7; }
    else if (left >= 6) { sizes.push(6); left -= 6; }
    else { sizes[sizes.length - 1] += left; left = 0; }
  }
  return sizes;
}

export function makePools(fencers) {
  const seeded = fencers.slice().sort((a, b) => (a.ranking || 999) - (b.ranking || 999));
  const sizes = poolSizes(seeded.length);
  const pools = sizes.map((size, i) => ({
    id: "p" + (i + 1),
    name: "Poule " + (i + 1),
    size,
    fencerIds: [],
    bouts: [],
  }));
  seeded.forEach((f, i) => {
    const col = i % pools.length;
    const row = Math.floor(i / pools.length);
    const target = row % 2 === 0 ? col : pools.length - 1 - col;
    pools[target].fencerIds.push(f.id);
  });
  pools.forEach((p) => {
    p.bouts = pairRoundRobin(p.fencerIds);
  });
  return pools;
}

export function pairRoundRobin(ids) {
  const bouts = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      bouts.push({
        id: ids[i] + "_" + ids[j],
        a: ids[i],
        b: ids[j],
        scoreA: null,
        scoreB: null,
        status: "a-venir",
        strip: null,
      });
    }
  }
  return bouts;
}

export function poolTable(pool, fencersById) {
  const rows = pool.fencerIds.map((fid) => {
    let v = 0, td = 0, tr = 0, matches = 0;
    pool.bouts.forEach((bt) => {
      if (bt.scoreA == null) return;
      if (bt.a === fid) {
        matches++; td += bt.scoreA; tr += bt.scoreB;
        if (bt.scoreA > bt.scoreB) v++;
      } else if (bt.b === fid) {
        matches++; td += bt.scoreB; tr += bt.scoreA;
        if (bt.scoreB > bt.scoreA) v++;
      }
    });
    return {
      fencerId: fid,
      name: fencersById[fid]?.name || "?",
      clubId: fencersById[fid]?.clubId,
      v, td, tr, indice: td - tr, matches,
      ratio: matches ? v / matches : 0,
    };
  });
  rows.sort((a, b) => b.v - a.v || b.indice - a.indice || b.td - a.td || a.name.localeCompare(b.name));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

export function overallFromPools(pools, fencersById) {
  const all = [];
  pools.forEach((p) => all.push(...poolTable(p, fencersById)));
  all.sort((a, b) => b.v - a.v || b.indice - a.indice || b.td - a.td);
  all.forEach((r, i) => { r.overall = i + 1; });
  return all;
}

function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function makeTableau(ranked) {
  const n = ranked.length;
  const size = nextPow2(Math.max(2, n));
  const slots = Array(size).fill(null);
  const order = classicSeeds(size);
  ranked.forEach((r, i) => {
    slots[order[i]] = { ...r, seed: i + 1 };
  });
  const rounds = [];
  let roundSize = size / 2;
  let prev = slots.map((s, i) => ({
    id: "r0_" + i,
    player: s,
  }));
  while (roundSize >= 1) {
    const bouts = [];
    for (let i = 0; i < prev.length; i += 2) {
      const a = prev[i].player;
      const b = prev[i + 1]?.player || null;
      bouts.push({
        id: "t" + roundSize + "_" + i / 2,
        a, b,
        scoreA: a && !b ? 0 : null,
        scoreB: a && !b ? 0 : null,
        winner: a && !b ? a : null,
        status: a && !b ? "exempt" : "a-venir",
      });
    }
    rounds.push({ name: roundName(roundSize), size: roundSize, bouts });
    prev = bouts.map((bt) => ({ id: bt.id, player: bt.winner }));
    roundSize /= 2;
  }
  return { size, rounds };
}

function classicSeeds(size) {
  const arr = [1, 2];
  while (arr.length < size) {
    const n = arr.length * 2 + 1;
    const next = [];
    arr.forEach((s) => {
      next.push(s);
      next.push(n - s);
    });
    arr.length = 0;
    arr.push(...next);
  }
  return arr.map((s) => s - 1);
}

function roundName(size) {
  if (size === 1) return "Finale";
  if (size === 2) return "Demi-finales";
  if (size === 4) return "Quarts";
  if (size === 8) return "8e de finale";
  return "Tableau de " + size * 2;
}

export function assignStrips(bouts, stripCount) {
  const free = Array.from({ length: stripCount }, (_, i) => i + 1);
  const out = [];
  let i = 0;
  bouts.forEach((b) => {
    if (b.status === "termine" || b.status === "exempt") return;
    const strip = free[i % free.length];
    out.push({ ...b, strip, status: "en-piste" });
    i++;
  });
  return out;
}

export function seasonPointsFromPlace(place) {
  const table = [32, 26, 20, 16, 14, 12, 10, 8];
  if (place <= 8) return table[place - 1];
  if (place <= 16) return 4;
  if (place <= 32) return 2;
  return 1;
}

export function toEngardeCsv(tournament, event, rows, clubsById) {
  const lines = ["Nom;Prenom;Nation;Club;Licence;Classement"];
  rows.forEach((r, i) => {
    const parts = (r.name || "").split(" ");
    const prenom = parts.pop();
    const nom = parts.join(" ");
    lines.push([nom, prenom, "FRA", clubsById[r.clubId]?.short || "", "", i + 1].join(";"));
  });
  return lines.join("\n");
}

export { shuffle };
