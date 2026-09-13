import { loadState, saveState, resetState, WEAPONS, CATEGORIES, GENDERS, FORMULAS, initials, id } from "./store.js";
import { makePools, poolTable, overallFromPools, makeTableau, assignStrips, seasonPointsFromPlace, toEngardeCsv } from "./engine.js";

let state = loadState();
const app = document.getElementById("app");

function go(hash) { location.hash = hash; }
function persist() { saveState(state); }
function session() { return state.users.find((u) => u.id === state.session) || null; }
function clubOf(cid) { return state.clubs.find((c) => c.id === cid); }
function fencer(fid) { return state.fencers.find((f) => f.id === fid); }
function tournament(tid) { return state.tournaments.find((t) => t.id === tid); }
function labelRole(r) { return ({ organisateur: "Orga", secretariat: "Table", tireur: "Tireur", parent: "Parent" }[r] || r); }
function weaponLabel(wid) { return WEAPONS.find((w) => w.id === wid)?.label || wid; }
function eventLabel(ev) {
  const type = ev.type === "equipes" ? "Équipes" : "Individuel";
  const g = GENDERS.find((x) => x.id === ev.gender)?.label || "";
  return `${weaponLabel(ev.weapon)} ${ev.category} ${g} · ${type}`;
}
function statusLabel(s) { return { ouvert: "Inscriptions ouvertes", "jour-j": "En cours aujourd’hui", clos: "Terminé" }[s] || s; }
function statusReg(r) {
  if (r.status === "forfait") return "Forfait";
  if (r.status === "liste-attente") return "Liste d’attente";
  return r.checkedIn ? "Présent" : "Inscrit";
}
function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function toast(msg) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}
function layout(content, active = "home") {
  const user = session();
  const online = navigator.onLine;
  return `${online ? "" : `<div class="banner">Hors ligne — tout reste enregistré sur cet appareil.</div>`}
  <header class="topbar"><a class="brand" href="#/"><div class="mark">Al</div><div><strong>Allez</strong><span>tournois d'escrime</span></div></a>
  <div class="row"><span class="pill"><span class="dot ${online ? "" : "off"}"></span>${online ? "En ligne" : "Hors ligne"}</span>
  ${user ? `<a class="pill" href="#/compte">${user.name.split(" ")[0]} · ${labelRole(user.role)}</a>` : `<a class="btn sm" href="#/entrer">Entrer</a>`}</div></header>
  <main class="wrap">${content}</main>
  <nav class="nav-bottom">
    <a class="${active === "home" ? "on" : ""}" href="#/">Tournois</a>
    <a class="${active === "club" ? "on" : ""}" href="#/club">Club</a>
    <a class="${active === "jour" ? "on" : ""}" href="#/jour">Jour J</a>
    <a class="${active === "moi" ? "on" : ""}" href="#/moi">Moi</a>
  </nav>`;
}
function set(html) { app.innerHTML = html; bind(); }
function render(parts) {
  const [a, b, c] = parts;
  const params = Object.fromEntries(new URLSearchParams((location.hash.split("?")[1] || "")));
  if (!a) return set(home());
  if (a === "entrer") return set(login());
  if (a === "compte") return set(account());
  if (a === "club") return set(clubScreen());
  if (a === "nouveau") return set(newTournament());
  if (a === "jour") return set(dayHub());
  if (a === "moi") return set(meScreen());
  if (a === "t" && b) return set(tournamentScreen(b, c, arguments[1], params));
  set(home());
}
function home() {
  const list = state.tournaments.map((t) => {
    const n = state.registrations.filter((r) => r.tournamentId === t.id && r.status !== "forfait").length;
    return `<a class="card click" href="#/t/${t.id}" style="text-decoration:none"><p class="kicker">${fmtDate(t.date)} · ${t.strips} pistes</p><h3>${t.name}</h3><p class="tiny">${t.venue}</p><div class="row" style="margin-top:10px"><span class="badge ok">${statusLabel(t.status)}</span><span class="tiny">${n} inscrits</span></div></a>`;
  }).join("");
  return layout(`<section class="hero"><p class="kicker">Plateforme ouverte</p><h1>Le tournoi,<br>sans le papier.</h1><p class="lead">Inscriptions, check-in, poules, tableau et pistes — pensé pour le bénévole à la table et les parents dans les gradins.</p><div class="row" style="margin-top:16px"><a class="btn" href="#/nouveau">Créer un tournoi</a><a class="btn ghost" href="#/t/t_rhone/jour">Ouvrir le jour J démo</a></div></section><div class="grid cards" style="margin-top:22px">${list}</div>`, "home");
}
function login() {
  const cards = state.users.map((u) => `<button class="account" data-login="${u.id}"><b>${u.name}</b><span>${labelRole(u.role)} · ${clubOf(u.clubId)?.name || ""}</span></button>`).join("");
  return layout(`<section class="hero"><p class="kicker">Accès démo</p><h1>Qui êtes-vous<br>aujourd’hui ?</h1><p class="lead">Choisissez un rôle pour voir l’app comme eux.</p></section><div class="login-grid">${cards}</div>`, "moi");
}
function account() {
  const u = session();
  if (!u) return login();
  return layout(`<section class="hero"><p class="kicker">Compte</p><h1>${u.name}</h1><p class="lead">${labelRole(u.role)} · ${clubOf(u.clubId)?.name}</p></section><div class="card"><button class="btn ghost block" data-action="reset">Réinitialiser les données démo</button></div>`, "moi");
}
function clubScreen() {
  const club = clubOf(session()?.clubId || "c_lyon");
  const members = state.fencers.filter((f) => f.clubId === club.id);
  const link = "#/t/t_rhone/inscrire?club=" + club.id;
  const rows = members.map((f) => `<tr><td><b>${f.name}</b><div class="tiny">${f.licence}</div></td><td>${weaponLabel(f.weapon)}</td><td>${f.category} ${f.gender}</td></tr>`).join("");
  return layout(`<section class="hero"><p class="kicker">${club.city}</p><h1>${club.name}</h1><p class="lead">Le club envoie le lien. Le tireur s’inscrit lui-même.</p></section><div class="grid two"><div class="card"><h3>Lien d’inscription</h3><input class="search" id="invite" readonly value="${link}" /><div class="row" style="margin-top:10px"><button class="btn sm" data-copy="#invite">Copier le lien</button><a class="btn sm ghost" href="#/nouveau">Créer un tournoi</a></div></div><div class="card flat"><h3>Import CSV club</h3><p class="tiny">nom;arme;categorie;sexe;licence</p><textarea id="csv" rows="5"></textarea><button class="btn block" data-action="import-csv">Importer dans ${club.short}</button></div></div><div class="card" style="margin-top:14px;overflow:auto"><div class="row"><h3>Effectif</h3><span class="tiny right">${members.length} tireurs</span></div><table class="table"><thead><tr><th>Tireur</th><th>Arme</th><th>Cat.</th></tr></thead><tbody>${rows}</tbody></table></div>`, "club");
}
function newTournament() {
  const w = WEAPONS.map((x) => `<label class="check"><input type="checkbox" name="w" value="${x.id}" ${x.id === "epee" ? "checked" : ""}/> ${x.label}</label>`).join("");
  const c = CATEGORIES.map((x) => `<label class="check"><input type="checkbox" name="c" value="${x}" ${["M15","Senior"].includes(x)?"checked":""}/> ${x}</label>`).join("");
  const f = FORMULAS.map((x) => `<option value="${x.id}">${x.label}</option>`).join("");
  return layout(`<section class="hero"><p class="kicker">3 minutes max</p><h1>Nouveau tournoi</h1></section><form class="card" id="create-form"><div class="field"><label>Nom</label><input name="name" required placeholder="Open de printemps" /></div><div class="grid" style="grid-template-columns:1fr 1fr"><div class="field"><label>Date</label><input type="date" name="date" required value="2026-10-04" /></div><div class="field"><label>Heure</label><input type="time" name="time" value="09:00" /></div></div><div class="field"><label>Lieu</label><input name="venue" required placeholder="Gymnase, ville" /></div><div class="field"><label>Armes</label><div class="checks">${w}</div></div><div class="field"><label>Catégories</label><div class="checks">${c}</div></div><div class="grid" style="grid-template-columns:1fr 1fr 1fr"><div class="field"><label>Tarif €</label><input name="fee" type="number" value="12" /></div><div class="field"><label>Date limite</label><input type="date" name="deadline" value="2026-10-02" /></div><div class="field"><label>Pistes</label><input name="strips" type="number" value="6" /></div></div><div class="field"><label>Formule</label><select name="formula">${f}</select></div><label class="check"><input type="checkbox" name="teams" /> Épreuve par équipes</label><div style="height:12px"></div><button class="btn block" type="submit">Publier le tournoi</button></form>`, "club");
}
function tournamentScreen(tid, tab, sub, params) {
  const t = tournament(tid);
  if (!t) return home();
  if (tab === "inscrire") return registerScreen(t, params || {});
  if (tab === "jour") return dayScreen(t, sub);
  if (tab === "checkin") return checkinScreen(t);
  if (tab === "resultats") return resultsScreen(t);
  return tournamentPublic(t);
}
function tournamentPublic(t) {
  const n = state.registrations.filter((r) => r.tournamentId === t.id && r.status !== "forfait").length;
  const ev = t.events.map((e) => `<div class="list-item"><div><b>${eventLabel(e)}</b><div class="tiny">${FORMULAS.find(f=>f.id===e.formula)?.label}</div></div><span class="badge">${state.registrations.filter((r)=>r.eventId===e.id && r.status!=="forfait").length}</span></div>`).join("");
  return layout(`<section class="hero"><p class="kicker">${fmtDate(t.date)} · ${t.time}</p><h1>${t.name}</h1><p class="lead">${t.venue}<br>${n} inscrits · ${t.fee} € · clôture ${fmtDate(t.deadline)}</p><div class="row" style="margin-top:14px"><a class="btn" href="#/t/${t.id}/inscrire?club=c_lyon">S’inscrire via mon club</a><a class="btn ghost" href="#/t/${t.id}/jour">Table / Jour J</a></div></section><div class="grid two"><div class="card"><h3>Épreuves</h3>${ev}</div><div class="card flat"><h3>Infos clubs</h3><p>${t.notes || ""}</p><a class="btn sm" href="#/t/${t.id}/resultats">Résultats</a></div></div>`);
}
function registerScreen(t, params) {
  const club = clubOf(params.club || session()?.clubId || "c_lyon");
  const members = state.fencers.filter((f) => f.clubId === club.id);
  const options = members.map((f) => `<option value="${f.id}">${f.name} · ${f.category}</option>`).join("");
  const evs = t.events.map((e) => `<option value="${e.id}">${eventLabel(e)}</option>`).join("");
  const mine = state.registrations.filter((r) => r.tournamentId === t.id && r.clubId === club.id);
  const list = mine.map((r) => { const f = fencer(r.fencerId); return `<div class="list-item"><div class="avatar">${initials(f?.name)}</div><div><b>${f?.name}</b><div class="tiny">${statusReg(r)}</div></div><span class="badge ${r.status==="liste-attente"?"wait":"ok"}">${r.status}</span></div>`; }).join("") || `<p class="empty">Personne du club inscrit pour l’instant.</p>`;
  return layout(`<section class="hero"><p class="kicker">${club.name}</p><h1>Inscription</h1><p class="lead">${t.name}</p></section><form class="card" id="reg-form" data-tid="${t.id}" data-club="${club.id}"><div class="field"><label>Tireur</label><select name="fencerId">${options}</select></div><div class="field"><label>Épreuve</label><select name="eventId">${evs}</select></div><button class="btn block" type="submit">Valider l’inscription</button></form><div class="card" style="margin-top:14px"><h3>Déjà inscrits du club</h3>${list}</div>`, "moi");
}
function dayHub() { const t = state.tournaments.find((x) => x.status === "jour-j") || state.tournaments[0]; return dayScreen(t); }
function dayScreen(t, sub) {
  const ev = t.events.find((e) => e.id === sub) || t.events[0];
  const regs = state.registrations.filter((r) => r.tournamentId === t.id && r.eventId === ev.id && r.status !== "forfait");
  const present = regs.filter((r) => r.checkedIn);
  const key = t.id + ":" + ev.id;
  const pools = state.pools[key] || [];
  const next = nextAction(t, ev, regs, pools);
  const tabs = t.events.map((e) => `<a class="tab ${e.id===ev.id?"on":""}" href="#/t/${t.id}/jour/${e.id}">${weaponLabel(e.weapon)} ${e.category}${e.type==="equipes"?" Éq.":""}</a>`).join("");
  return layout(`<div class="cockpit"><p class="kicker">${t.venue} · ${t.strips} pistes</p><h2 style="color:#f4efe6">${t.name}</h2><p class="tiny">${present.length}/${regs.length} présents · ${ev.formula}</p><div class="next-action"><p class="kicker">Prochaine action</p><h3 style="color:#fff">${next.title}</h3><p class="tiny">${next.hint}</p><div class="row" style="margin-top:10px">${next.actions}</div></div></div><div class="tabs" style="margin:14px 0">${tabs}</div>${pools.length ? poolsView(t, ev, key) : secretariatList(t, ev, regs)}`, "jour");
}
function nextAction(t, ev, regs, pools) {
  const present = regs.filter((r) => r.checkedIn);
  if (present.length < 4) return { title: "Faire le check-in", hint: "QR ou recherche par nom.", actions: `<a class="btn gold" href="#/t/${t.id}/checkin">Ouvrir le check-in</a>` };
  if (!pools.length) return { title: "Tirer les poules", hint: "Répartition auto.", actions: `<button class="btn gold" data-action="make-pools" data-tid="${t.id}" data-eid="${ev.id}">Composer les poules</button>` };
  const open = pools.flatMap((p) => p.bouts).filter((b) => b.status !== "termine");
  if (open.length) return { title: `${open.length} matchs de poule restants`, hint: "Affectation auto des pistes.", actions: `<button class="btn gold" data-action="assign" data-tid="${t.id}" data-eid="${ev.id}">Lancer sur les pistes</button>` };
  return { title: "Clôturer et faire le tableau", hint: "Classement V / indice / touches.", actions: `<button class="btn gold" data-action="make-tableau" data-tid="${t.id}" data-eid="${ev.id}">Générer le tableau</button><a class="btn ghost" href="#/t/${t.id}/resultats" style="color:#fff;border-color:#5a5046">Voir résultats</a>` };
}
function secretariatList(t, ev, regs) {
  const rows = regs.map((r) => { const f = fencer(r.fencerId); return `<div class="list-item"><div class="avatar">${initials(f?.name)}</div><div><b>${f?.name}</b><div class="tiny">${clubOf(f?.clubId)?.short} · ${r.paid ? "payé" : "à régler"}</div></div><span class="badge ${r.checkedIn?"ok": r.status==="liste-attente"?"wait":"off"}">${r.checkedIn?"présent":r.status}</span></div>`; }).join("");
  return `<div class="card"><div class="row"><h3>Secrétariat</h3><a class="btn sm" href="#/t/${t.id}/checkin">Check-in</a></div>${rows}</div>`;
}
function poolsView(t, ev, key) {
  const pools = state.pools[key] || [];
  const byId = Object.fromEntries(state.fencers.map((f) => [f.id, f]));
  const blocks = pools.map((p) => {
    const table = poolTable(p, byId);
    const body = table.map((r) => `<tr><td>${r.rank}</td><td>${r.name}<div class="tiny">${clubOf(r.clubId)?.short || ""}</div></td><td>${r.v}</td><td>${r.indice}</td><td>${r.td}</td></tr>`).join("");
    const bouts = p.bouts.map((b) => boutRow(b, byId, t.id, ev.id, p.id)).join("");
    return `<div class="card"><h3>${p.name}</h3><table class="table"><thead><tr><th>#</th><th>Tireur</th><th>V</th><th>Ind</th><th>TD</th></tr></thead><tbody>${body}</tbody></table><div style="margin-top:8px">${bouts}</div></div>`;
  }).join("");
  const ranked = overallFromPools(pools, byId);
  const tab = state.tableaux[key];
  return `<div class="grid cards">${blocks}</div><div class="card" style="margin-top:14px"><div class="row"><h3>Classement général poules</h3><button class="btn sm" data-action="make-tableau" data-tid="${t.id}" data-eid="${ev.id}">Tableau</button></div><table class="table"><thead><tr><th>Cl.</th><th>Tireur</th><th>V</th><th>Ind</th></tr></thead><tbody>${ranked.map((r)=>`<tr><td>${r.overall}</td><td>${r.name}</td><td>${r.v}</td><td>${r.indice}</td></tr>`).join("")}</tbody></table></div>${tab ? tableauView(tab) : ""}${pistesView(t, key)}`;
}
function boutRow(b, byId, tid, eid, pid) {
  const a = byId[b.a]; const c = byId[b.b]; const done = b.status === "termine";
  return `<div class="score"><div class="who side-red">${a?.name}<small>${clubOf(a?.clubId)?.short || ""}</small></div><div class="pts">${done ? `${b.scoreA}–${b.scoreB}` : "–"}</div><div class="who side-green" style="text-align:right">${c?.name}<small>${clubOf(c?.clubId)?.short || ""}</small></div></div>${done ? "" : `<button class="btn sm block" data-score="${tid}|${eid}|${pid}|${b.id}">Saisir le score</button>`}`;
}
function tableauView(tab) {
  const cols = tab.rounds.map((r) => `<div style="min-width:200px"><h3>${r.name}</h3>${r.bouts.map((b) => `<div class="bout-chip"><div class="tiny">${r.name}${b.status==="exempt"?" · exempt":""}</div><div>${b.a?.name || "—"} <span class="sc">${b.scoreA ?? ""}</span></div><div>${b.b?.name || "exempt"} <span class="sc">${b.scoreB ?? ""}</span></div></div>`).join("")}</div>`).join("");
  return `<div class="card tree" style="margin-top:14px"><h3>Tableau</h3><div class="row" style="align-items:flex-start">${cols}</div></div>`;
}
function pistesView(t, key) {
  const live = (state.assignments || []).filter((a) => a.key === key && a.status === "en-piste");
  const tiles = Array.from({ length: t.strips }, (_, i) => {
    const bout = live.find((x) => x.strip === i + 1);
    if (!bout) return `<div class="piste free"><div class="n">Piste ${i + 1}</div><b>Libre</b></div>`;
    const a = fencer(bout.a); const b = fencer(bout.b);
    return `<div class="piste"><div class="n">Piste ${i + 1}</div><b>${a?.name || "?"} · ${b?.name || "?"}</b><div class="tiny">En cours</div></div>`;
  }).join("");
  return `<div style="margin-top:14px"><h3>Pistes</h3><div class="piste-board">${tiles}</div></div>`;
}
function checkinScreen(t) {
  const rows = state.registrations.filter((r) => r.tournamentId === t.id).map((r) => {
    const f = fencer(r.fencerId);
    return `<div class="list-item"><div class="avatar">${initials(f?.name)}</div><div><b>${f?.name}</b><div class="tiny">${clubOf(f?.clubId)?.short}</div></div><div class="row">${r.status !== "forfait" ? `<button class="btn sm ${r.checkedIn?"ghost":""}" data-check="${r.id}">${r.checkedIn?"Annuler":"Présent"}</button><button class="btn sm ghost" data-forfait="${r.id}">Forfait</button>` : `<span class="badge off">forfait</span>`}</div></div>`;
  }).join("");
  return layout(`<section class="hero"><p class="kicker">Accueil</p><h1>Check-in</h1></section><div class="grid two"><div class="card"><input class="search" id="q" placeholder="Nom du tireur…" />${rows}</div><div class="card flat" style="text-align:center"><p class="kicker">QR club</p><div class="qr"></div><a class="btn ghost" href="#/t/${t.id}/jour">Retour table</a></div></div>`, "jour");
}
function resultsScreen(t) {
  const ev = t.events[0]; const key = t.id + ":" + ev.id;
  const pools = state.pools[key] || [];
  const byId = Object.fromEntries(state.fencers.map((f) => [f.id, f]));
  const ranked = pools.length ? overallFromPools(pools, byId) : [];
  const rows = ranked.length ? ranked.map((r, i) => `<tr><td>${i + 1}</td><td>${r.name}<div class="tiny">${clubOf(r.clubId)?.short}</div></td><td>${r.v}</td><td>${r.indice}</td><td>${seasonPointsFromPlace(i + 1)} pts</td></tr>`).join("") : `<tr><td colspan="5" class="muted">Les résultats apparaîtront après les poules.</td></tr>`;
  return layout(`<section class="hero"><p class="kicker">Après le tournoi</p><h1>Résultats</h1></section><div class="row" style="margin-bottom:12px"><button class="btn" data-action="export-csv" data-tid="${t.id}" data-eid="${ev.id}">Export CSV Engarde</button><button class="btn ghost" data-action="print">Imprimer / PDF</button></div><div class="card"><table class="table"><thead><tr><th>Cl.</th><th>Tireur</th><th>V</th><th>Ind</th><th>Challenge</th></tr></thead><tbody>${rows}</tbody></table></div>`);
}
function meScreen() {
  const u = session() || state.users.find((x) => x.role === "tireur");
  const fid = u.fencerId || (u.childIds && u.childIds[0]) || "f_lea";
  const f = fencer(fid);
  const hist = state.registrations.filter((r) => r.fencerId === fid).map((r) => { const t = tournament(r.tournamentId); return `<div class="list-item"><div><b>${t?.name}</b><div class="tiny">${statusReg(r)}</div></div><a class="btn sm ghost" href="#/t/${t.id}">Voir</a></div>`; }).join("");
  return layout(`<section class="hero"><p class="kicker">${u.role === "parent" ? "Espace parent" : "Espace tireur"}</p><h1>${f?.name || u.name}</h1><p class="lead">${clubOf(f?.clubId)?.name} · ${f?.category} ${weaponLabel(f?.weapon)}</p></section><div class="card" style="margin-top:14px"><h3>Inscriptions</h3>${hist || "<p class='empty'>Aucune</p>"}</div>`, "moi");
}
function openScore(token) {
  const [tid, eid, pid, bid] = token.split("|");
  const pool = (state.pools[tid + ":" + eid] || []).find((p) => p.id === pid);
  const bout = pool?.bouts.find((b) => b.id === bid);
  if (!bout) return;
  const a = fencer(bout.a); const b = fencer(bout.b);
  const wrap = document.createElement("div");
  wrap.className = "modal-bg";
  wrap.innerHTML = `<div class="modal"><p class="kicker">Saisie</p><h3>${a?.name} — ${b?.name}</h3><div class="stepper"><button type="button" data-d="a-">−</button><input id="sa" value="5" inputmode="numeric" /><button type="button" data-d="a+">+</button></div><div class="stepper"><button type="button" data-d="b-">−</button><input id="sb" value="3" inputmode="numeric" /><button type="button" data-d="b+">+</button></div><button class="btn block" id="ok-score">Enregistrer</button><button class="btn ghost block" id="cancel-score" style="margin-top:8px">Annuler</button></div>`;
  document.body.appendChild(wrap);
  const sa = wrap.querySelector("#sa"); const sb = wrap.querySelector("#sb");
  wrap.querySelectorAll("[data-d]").forEach((btn) => btn.onclick = () => { const k = btn.dataset.d; const el = k[0] === "a" ? sa : sb; el.value = Math.max(0, Number(el.value || 0) + (k[1] === "+" ? 1 : -1)); });
  wrap.querySelector("#cancel-score").onclick = () => wrap.remove();
  wrap.querySelector("#ok-score").onclick = () => { bout.scoreA = Number(sa.value); bout.scoreB = Number(sb.value); bout.status = "termine"; persist(); wrap.remove(); route(); };
}
function bind() {
  document.querySelectorAll("[data-login]").forEach((el) => { el.onclick = () => { state.session = el.dataset.login; persist(); go("#/"); toast("Connecté"); }; });
  document.querySelector("[data-action='reset']")?.addEventListener("click", () => { state = resetState(); go("#/"); toast("Données remises à zéro"); });
  document.querySelector("[data-copy]")?.addEventListener("click", async (e) => { const input = document.querySelector(e.currentTarget.dataset.copy); try { await navigator.clipboard.writeText(location.origin + location.pathname + input.value); } catch {} toast("Lien copié"); });
  document.querySelector("[data-action='import-csv']")?.addEventListener("click", () => { const u = session() || { clubId: "c_lyon" }; const raw = document.querySelector("#csv").value.trim(); if (!raw) return toast("Collez un CSV"); raw.split(/\n/).forEach((line) => { const [name, weapon, category, gender, licence] = line.split(";").map((x) => x.trim()); if (!name) return; state.fencers.push({ id: id("f"), name, weapon: weapon || "epee", category: category || "Senior", gender: gender || "M", clubId: u.clubId, licence: licence || "", ranking: 80 }); }); persist(); toast("Import terminé"); route(); });
  document.querySelector("#create-form")?.addEventListener("submit", (e) => { e.preventDefault(); const fd = new FormData(e.target); const weapons = [...e.target.querySelectorAll("[name=w]:checked")].map((x) => x.value); const categories = [...e.target.querySelectorAll("[name=c]:checked")].map((x) => x.value); const events = []; weapons.forEach((w) => categories.forEach((cat) => { events.push({ id: id("e"), weapon: w, category: cat, gender: "M", type: "individuel", formula: fd.get("formula"), touchesPoule: 5, touchesTableau: 15 }); })); if (fd.get("teams")) events.push({ id: id("e"), weapon: weapons[0] || "epee", category: "Senior", gender: "M", type: "equipes", formula: "equipes-relais", touchesPoule: 5, touchesTableau: 45 }); const t = { id: id("t"), name: fd.get("name"), clubId: session()?.clubId || "c_lyon", date: fd.get("date"), time: fd.get("time"), venue: fd.get("venue"), weapons, categories, fee: Number(fd.get("fee") || 0), teamFee: 40, deadline: fd.get("deadline"), strips: Number(fd.get("strips") || 6), status: "ouvert", events, season: "2026-2027", notes: "" }; state.tournaments.unshift(t); persist(); toast("Tournoi publié"); go("#/t/" + t.id); });
  document.querySelector("#reg-form")?.addEventListener("submit", (e) => { e.preventDefault(); const fd = new FormData(e.target); const tid = e.target.dataset.tid; const evRegs = state.registrations.filter((r) => r.tournamentId === tid && r.eventId === fd.get("eventId") && r.status !== "forfait"); const status = evRegs.length >= 24 ? "liste-attente" : "inscrit"; state.registrations.push({ id: id("r"), tournamentId: tid, eventId: fd.get("eventId"), fencerId: fd.get("fencerId"), clubId: e.target.dataset.club, status, checkedIn: false, fee: 12, paid: false }); persist(); toast(status === "liste-attente" ? "Placé en liste d’attente" : "Inscription OK"); route(); });
  document.querySelector("[data-action='make-pools']")?.addEventListener("click", (e) => { const { tid, eid } = e.currentTarget.dataset; const regs = state.registrations.filter((r) => r.tournamentId === tid && r.eventId === eid && r.checkedIn && r.status !== "forfait"); state.pools[tid + ":" + eid] = makePools(regs.map((r) => fencer(r.fencerId)).filter(Boolean)); persist(); toast("Poules composées"); go(`#/t/${tid}/jour/${eid}`); });
  document.querySelector("[data-action='assign']")?.addEventListener("click", (e) => { const { tid, eid } = e.currentTarget.dataset; const t = tournament(tid); const key = tid + ":" + eid; const bouts = (state.pools[key] || []).flatMap((p) => p.bouts.map((b) => ({ ...b, poolId: p.id }))); state.assignments = assignStrips(bouts, t.strips).map((a) => ({ ...a, key })); persist(); toast("Pistes affectées"); route(); });
  document.querySelector("[data-action='make-tableau']")?.addEventListener("click", (e) => { const { tid, eid } = e.currentTarget.dataset; const key = tid + ":" + eid; const byId = Object.fromEntries(state.fencers.map((f) => [f.id, f])); const ranked = overallFromPools(state.pools[key] || [], byId); state.tableaux[key] = makeTableau(ranked); ranked.forEach((r, i) => { state.seasonPoints[r.clubId] = (state.seasonPoints[r.clubId] || 0) + seasonPointsFromPlace(i + 1); }); persist(); toast("Tableau généré"); route(); });
  document.querySelectorAll("[data-score]").forEach((el) => { el.onclick = () => openScore(el.dataset.score); });
  document.querySelectorAll("[data-check]").forEach((el) => { el.onclick = () => { const r = state.registrations.find((x) => x.id === el.dataset.check); r.checkedIn = !r.checkedIn; if (r.status === "liste-attente") r.status = "inscrit"; persist(); route(); }; });
  document.querySelectorAll("[data-forfait]").forEach((el) => { el.onclick = () => { const r = state.registrations.find((x) => x.id === el.dataset.forfait); r.status = "forfait"; r.checkedIn = false; persist(); toast("Forfait du matin enregistré"); route(); }; });
  document.querySelector("#q")?.addEventListener("input", (e) => { const q = e.target.value.toLowerCase(); document.querySelectorAll(".list-item").forEach((row) => { row.style.display = row.textContent.toLowerCase().includes(q) ? "" : "none"; }); });
  document.querySelector("[data-action='export-csv']")?.addEventListener("click", (e) => { const { tid, eid } = e.currentTarget.dataset; const t = tournament(tid); const key = tid + ":" + eid; const byId = Object.fromEntries(state.fencers.map((f) => [f.id, f])); const ranked = overallFromPools(state.pools[key] || [], byId); const clubs = Object.fromEntries(state.clubs.map((c) => [c.id, c])); const csv = toEngardeCsv(t, eid, ranked, clubs); const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "allez-engarde.csv"; a.click(); toast("CSV Engarde téléchargé"); });
  document.querySelector("[data-action='print']")?.addEventListener("click", () => window.print());
}
function route() {
  const raw = (location.hash || "#/").slice(1);
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);
  const params = Object.fromEntries(new URLSearchParams(query || ""));
  const [a, b, c] = parts;
  if (!a) return set(home());
  if (a === "entrer") return set(login());
  if (a === "compte") return set(account());
  if (a === "club") return set(clubScreen());
  if (a === "nouveau") return set(newTournament());
  if (a === "jour") return set(dayHub());
  if (a === "moi") return set(meScreen());
  if (a === "t" && b) return set(tournamentScreen(b, c, parts[2], params));
  set(home());
}
window.addEventListener("hashchange", route);
window.addEventListener("online", route);
window.addEventListener("offline", route);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
route();
