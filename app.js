import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=7";

const VOYAGEURS = ["Solange", "Emmanuelle", "Jean-Laurent", "Héloïse", "Thomas"];
const ONGLETS = ["programme", "ressources", "infos"];

const TYPES = {
  visite: "🏛️",
  restaurant: "🍝",
  activite: "🎭",
};
const STATUTS = {
  a_reserver: "🟠 À réserver",
  reserve: "🔵 Réservé",
  libre: "⚪ Sans réservation",
  fait: "🟢 Fait",
};
// Un toucher sur le statut fait passer au suivant.
const STATUT_SUIVANT = {
  a_reserver: "reserve",
  reserve: "fait",
  libre: "fait",
  fait: "a_reserver",
};
const JOURS = ["2026-12-26", "2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30"];

// Le code secret du voyage est la partie de l'adresse après « # ».
// Il n'est jamais envoyé à GitHub, seulement à la base de données.
const code = decodeURIComponent(location.hash.slice(1));
window.addEventListener("hashchange", () => location.reload());

// Mémoire de l'appareil (qui je suis, dernier onglet ouvert).
// Peut être indisponible (navigation privée) : la page fonctionne quand même.
function lire(cle) {
  try { return localStorage.getItem(cle); } catch { return null; }
}
function ecrire(cle, valeur) {
  try {
    if (valeur === null) localStorage.removeItem(cle);
    else localStorage.setItem(cle, valeur);
  } catch {}
}

const $ = (id) => document.getElementById(id);
$("chargement").hidden = true;

let db;

if (code.length < 16) {
  $("lien-incomplet").hidden = false;
} else {
  db = getFirestore(initializeApp(firebaseConfig));
  demarrer();
}

function demarrer() {
  // Boutons « Qui êtes-vous ? »
  for (const prenom of VOYAGEURS) {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.textContent = prenom;
    bouton.addEventListener("click", () => {
      ecrire("voyageur", prenom);
      afficher();
    });
    $("boutons-voyageurs").append(bouton);
  }

  $("changer").addEventListener("click", () => {
    ecrire("voyageur", null);
    afficher();
  });

  for (const bouton of document.querySelectorAll("[data-onglet]")) {
    bouton.addEventListener("click", () => ouvrirOnglet(bouton.dataset.onglet));
  }

  demarrerProgramme();
  demarrerInfos();
  afficher();
}

function moi() {
  return lire("voyageur");
}

function afficher() {
  const connu = VOYAGEURS.includes(moi());
  $("choix-voyageur").hidden = connu;
  $("application").hidden = !connu;
  if (connu) {
    $("prenom").textContent = moi();
    ouvrirOnglet(lire("onglet"));
  }
}

function ouvrirOnglet(nom) {
  if (!ONGLETS.includes(nom)) nom = ONGLETS[0];
  ecrire("onglet", nom);
  for (const id of ONGLETS) $(id).hidden = id !== nom;
  for (const bouton of document.querySelectorAll("[data-onglet]")) {
    if (bouton.dataset.onglet === nom) bouton.setAttribute("aria-current", "page");
    else bouton.removeAttribute("aria-current");
  }
  window.scrollTo(0, 0);
}

function signalerErreur(element, erreur) {
  console.error(erreur);
  element.textContent = erreur?.code === "permission-denied"
    ? "La base refuse l'accès. Les règles de sécurité ne sont peut-être pas à jour."
    : "Problème de connexion à la base. Vérifiez votre connexion internet.";
  element.className = "etat erreur";
  element.hidden = false;
}

// Crée un élément HTML avec une classe et un texte (le texte n'est jamais interprété comme du code).
function el(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

function jourLisible(jour) {
  const [a, m, j] = jour.split("-").map(Number);
  const texte = new Date(a, m - 1, j).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

// N'accepte que les vrais liens web (jamais « javascript: » ou autre).
function lienSur(lien) {
  try {
    const url = new URL(lien);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/* ---------- Programme ---------- */

let idees = [];
let ideeOuverte = null; // null = nouvelle idée

function demarrerProgramme() {
  const programme = collection(db, "voyages", code, "programme");

  onSnapshot(
    programme,
    (resultat) => {
      $("etat-programme").hidden = true;
      idees = resultat.docs.map((d) => ({ id: d.id, ...d.data() }));
      afficherProgramme();
    },
    (erreur) => signalerErreur($("etat-programme"), erreur)
  );

  const fiche = $("fiche-programme");
  const formulaire = $("formulaire-programme");

  $("ajouter-programme").addEventListener("click", () => ouvrirFiche(null));
  $("annuler-programme").addEventListener("click", () => fiche.close());

  // « Retirer » ne supprime rien : l'idée va dans « Non affecté », en bas du programme,
  // avec toutes ses informations. On la remet au programme en lui redonnant un jour.
  $("retirer-programme").addEventListener("click", async () => {
    if (!ideeOuverte) return;
    fiche.close();
    try {
      await updateDoc(doc(programme, ideeOuverte.id), {
        jour: "", modifiePar: moi(), modifieLe: serverTimestamp(),
      });
    } catch (erreur) {
      signalerErreur($("etat-programme"), erreur);
    }
  });

  // Suppression définitive : seulement pour une idée déjà « Non affecté ».
  $("supprimer-programme").addEventListener("click", async () => {
    if (!ideeOuverte) return;
    if (!confirm(`Supprimer définitivement « ${ideeOuverte.nom} » pour toute la famille ?`)) return;
    fiche.close();
    try {
      await deleteDoc(doc(programme, ideeOuverte.id));
    } catch (erreur) {
      signalerErreur($("etat-programme"), erreur);
    }
  });

  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const f = formulaire.elements;
    const donnees = {
      nom: f.nom.value.trim(),
      type: f.type.value,
      jour: f.jour.value,
      heure: f.heure.value,
      statut: f.statut.value,
      etoile: f.etoile.checked,
      prix: f.prix.value.trim(),
      lien: f.lien.value.trim(),
      note: f.note.value.trim(),
      modifiePar: moi(),
      modifieLe: serverTimestamp(),
    };
    if (!donnees.nom) return;
    fiche.close();
    try {
      if (ideeOuverte) {
        await updateDoc(doc(programme, ideeOuverte.id), donnees);
      } else {
        await addDoc(programme, { ...donnees, auteur: moi(), creeLe: serverTimestamp() });
      }
    } catch (erreur) {
      signalerErreur($("etat-programme"), erreur);
    }
  });
}

function ouvrirFiche(idee) {
  ideeOuverte = idee;
  const f = $("formulaire-programme").elements;
  const i = idee || {};
  const affectee = JOURS.includes(i.jour);
  $("titre-fiche-programme").textContent = !idee ? "Nouvelle idée" : affectee ? "Modifier" : "Remettre au programme";
  $("aide-fiche-programme").textContent = idee && !affectee
    ? "Choisissez un jour (et une heure), puis « Enregistrer » : l'idée reprendra sa place dans le programme."
    : "";
  f.nom.value = i.nom || "";
  f.type.value = TYPES[i.type] ? i.type : "visite";
  f.jour.value = JOURS.includes(i.jour) ? i.jour : "";
  f.heure.value = i.heure || "";
  f.statut.value = STATUTS[i.statut] ? i.statut : "a_reserver";
  f.etoile.checked = Boolean(i.etoile);
  f.prix.value = i.prix || "";
  f.lien.value = i.lien || "";
  f.note.value = i.note || "";
  $("auteur-fiche-programme").textContent = idee?.auteur ? `Proposé par ${idee.auteur}` : "";
  $("retirer-programme").hidden = !idee || !affectee;
  $("supprimer-programme").hidden = !idee || affectee;
  $("fiche-programme").showModal();
}

async function changerStatut(idee) {
  const statut = STATUT_SUIVANT[idee.statut] || "a_reserver";
  try {
    await updateDoc(doc(db, "voyages", code, "programme", idee.id), {
      statut, modifiePar: moi(), modifieLe: serverTimestamp(),
    });
  } catch (erreur) {
    signalerErreur($("etat-programme"), erreur);
  }
}

async function basculerEtoile(idee) {
  try {
    await updateDoc(doc(db, "voyages", code, "programme", idee.id), {
      etoile: !idee.etoile, modifiePar: moi(), modifieLe: serverTimestamp(),
    });
  } catch (erreur) {
    signalerErreur($("etat-programme"), erreur);
  }
}

function afficherProgramme() {
  const liste = $("liste-programme");
  liste.replaceChildren();

  if (idees.length === 0) {
    liste.append(el("p", "vide", "Aucune idée pour l'instant. Touchez « + Ajouter » pour proposer la première !"));
    return;
  }

  // Dans chaque groupe : par heure (le programme se lit dans l'ordre de la journée),
  // puis les incontournables d'abord, puis par nom.
  const ordre = (a, b) =>
    (a.heure || "99").localeCompare(b.heure || "99") ||
    (b.etoile ? 1 : 0) - (a.etoile ? 1 : 0) ||
    (a.nom || "").localeCompare(b.nom || "", "fr");

  const groupes = [
    ...JOURS.map((jour) => [jourLisible(jour), idees.filter((i) => i.jour === jour)]),
    ["Non affecté", idees.filter((i) => !JOURS.includes(i.jour))],
  ];

  for (const [titre, elements] of groupes) {
    if (elements.length === 0) continue;
    liste.append(el("h3", "titre-jour", titre));
    for (const idee of elements.sort(ordre)) liste.append(carteIdee(idee));
  }
}

function carteIdee(idee) {
  const carte = el("article", "carte"
    + (idee.statut === "fait" ? " faite" : "")
    + (JOURS.includes(idee.jour) ? "" : " non-affectee"));

  const haut = el("div", "carte-haut");
  const ouvrir = el("button", "carte-titre");
  ouvrir.type = "button";
  if (idee.heure && JOURS.includes(idee.jour)) ouvrir.append(el("span", "heure", idee.heure.replace(":", "h")));
  ouvrir.append(el("span", "icone", TYPES[idee.type] || "📍"), el("span", "", idee.nom || "(sans nom)"));
  ouvrir.addEventListener("click", () => ouvrirFiche(idee));

  const etoile = el("button", "etoile" + (idee.etoile ? " active" : ""), idee.etoile ? "⭐" : "☆");
  etoile.type = "button";
  etoile.setAttribute("aria-label", idee.etoile ? "Retirer des incontournables" : "Marquer comme incontournable");
  etoile.addEventListener("click", () => basculerEtoile(idee));
  haut.append(ouvrir, etoile);
  carte.append(haut);

  if (idee.prix) carte.append(el("p", "details", idee.prix));
  if (idee.note) carte.append(el("p", "note", idee.note));

  const lien = lienSur(idee.lien);
  if (lien) {
    const a = el("a", "lien-externe", "Ouvrir le lien ↗");
    a.href = lien;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    carte.append(a);
  }

  const bas = el("div", "carte-bas");
  const statut = el("button", "statut statut-" + (STATUTS[idee.statut] ? idee.statut : "a_reserver"),
    STATUTS[idee.statut] || STATUTS.a_reserver);
  statut.type = "button";
  statut.setAttribute("aria-label", "Statut : " + statut.textContent + ". Toucher pour passer au suivant.");
  statut.addEventListener("click", () => changerStatut(idee));
  const modifier = el("button", "bouton-modifier",
    JOURS.includes(idee.jour) ? "✏️ Modifier" : "↩️ Remettre au programme");
  modifier.type = "button";
  modifier.addEventListener("click", () => ouvrirFiche(idee));
  bas.append(statut, modifier);
  carte.append(bas);
  if (idee.auteur) carte.append(el("p", "discret auteur", "Proposé par " + idee.auteur));

  return carte;
}

/* ---------- Infos pratiques ---------- */

const CATEGORIES = {
  transport: "✈️ Transports",
  hebergement: "🏨 Hébergement",
  autre: "📌 Autres infos",
};

let infos = [];
let infoOuverte = null; // null = nouvelle info

function demarrerInfos() {
  const collectionInfos = collection(db, "voyages", code, "infos");

  onSnapshot(
    collectionInfos,
    (resultat) => {
      $("etat-infos").hidden = true;
      infos = resultat.docs.map((d) => ({ id: d.id, ...d.data() }));
      afficherInfos();
    },
    (erreur) => signalerErreur($("etat-infos"), erreur)
  );

  const fiche = $("fiche-infos");
  const formulaire = $("formulaire-infos");

  $("ajouter-infos").addEventListener("click", () => ouvrirFicheInfos(null));
  $("annuler-infos").addEventListener("click", () => fiche.close());

  $("supprimer-infos").addEventListener("click", async () => {
    if (!infoOuverte) return;
    if (!confirm(`Supprimer « ${infoOuverte.titre} » pour toute la famille ?`)) return;
    fiche.close();
    try {
      await deleteDoc(doc(collectionInfos, infoOuverte.id));
    } catch (erreur) {
      signalerErreur($("etat-infos"), erreur);
    }
  });

  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const f = formulaire.elements;
    const donnees = {
      categorie: f.categorie.value,
      titre: f.titre.value.trim(),
      jour: f.jour.value,
      heure: f.heure.value,
      details: f.details.value.trim(),
      adresse: f.adresse.value.trim(),
      lien: f.lien.value.trim(),
      modifiePar: moi(),
      modifieLe: serverTimestamp(),
    };
    if (!donnees.titre) return;
    fiche.close();
    try {
      if (infoOuverte) {
        await updateDoc(doc(collectionInfos, infoOuverte.id), donnees);
      } else {
        await addDoc(collectionInfos, { ...donnees, auteur: moi(), creeLe: serverTimestamp() });
      }
    } catch (erreur) {
      signalerErreur($("etat-infos"), erreur);
    }
  });
}

function ouvrirFicheInfos(info) {
  infoOuverte = info;
  const f = $("formulaire-infos").elements;
  const i = info || {};
  $("titre-fiche-infos").textContent = info ? "Modifier" : "Nouvelle info";
  f.categorie.value = CATEGORIES[i.categorie] ? i.categorie : "transport";
  f.titre.value = i.titre || "";
  f.jour.value = JOURS.includes(i.jour) ? i.jour : "";
  f.heure.value = i.heure || "";
  f.details.value = i.details || "";
  f.adresse.value = i.adresse || "";
  f.lien.value = i.lien || "";
  $("supprimer-infos").hidden = !info;
  $("fiche-infos").showModal();
}

function afficherInfos() {
  const liste = $("liste-infos");
  liste.replaceChildren();

  if (infos.length === 0) {
    liste.append(el("p", "vide", "Aucune info pour l'instant. Touchez « + Ajouter » pour la première."));
    return;
  }

  // Dans chaque catégorie : dans l'ordre du voyage.
  const ordre = (a, b) =>
    (a.jour || "9").localeCompare(b.jour || "9") ||
    (a.heure || "99").localeCompare(b.heure || "99") ||
    (a.titre || "").localeCompare(b.titre || "", "fr");

  for (const [categorie, titre] of Object.entries(CATEGORIES)) {
    const elements = infos.filter((i) => (CATEGORIES[i.categorie] ? i.categorie : "autre") === categorie);
    if (elements.length === 0) continue;
    liste.append(el("h3", "titre-jour", titre));
    for (const info of elements.sort(ordre)) liste.append(carteInfo(info));
  }
}

function carteInfo(info) {
  const carte = el("article", "carte");

  const haut = el("div", "carte-haut");
  const ouvrir = el("button", "carte-titre");
  ouvrir.type = "button";
  ouvrir.append(el("span", "", info.titre || "(sans titre)"));
  ouvrir.addEventListener("click", () => ouvrirFicheInfos(info));
  haut.append(ouvrir);
  carte.append(haut);

  const quand = [JOURS.includes(info.jour) ? jourLisible(info.jour) : "", info.heure ? info.heure.replace(":", "h") : ""]
    .filter(Boolean).join(" · ");
  if (quand) carte.append(el("p", "details", quand));
  if (info.details) carte.append(el("p", "note", info.details));

  if (info.adresse) {
    const a = el("a", "lien-externe", "📍 " + info.adresse);
    a.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(info.adresse);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    carte.append(a);
  }

  const lien = lienSur(info.lien);
  if (lien) {
    const a = el("a", "lien-externe", "Ouvrir le lien ↗");
    a.href = lien;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    carte.append(a);
  }

  const bas = el("div", "carte-bas");
  const modifier = el("button", "bouton-modifier", "✏️ Modifier");
  modifier.type = "button";
  modifier.addEventListener("click", () => ouvrirFicheInfos(info));
  bas.append(modifier);
  carte.append(bas);

  return carte;
}
