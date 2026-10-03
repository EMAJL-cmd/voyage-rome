import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove, writeBatch, setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=16";

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
// Il est aussi gardé sur l'appareil : si un raccourci perd la fin de l'adresse,
// l'application le retrouve quand même.
let code = decodeURIComponent(location.hash.slice(1));
if (code.length >= 16) {
  ecrire("code", code);
} else if ((lire("code") || "").length >= 16) {
  code = lire("code");
  history.replaceState(null, "", "#" + encodeURIComponent(code));
}
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

// Numéro de la version en cours (celui de « app.js?v=N » dans index.html).
const VERSION = new URL(import.meta.url).searchParams.get("v") || "?";

// Une application ajoutée à l'écran d'accueil peut rester ouverte des jours en arrière-plan.
// À chaque retour sur l'application, on vérifie si une version plus récente est en ligne,
// et si oui on recharge (une seule tentative par version, pour ne jamais boucler).
async function verifierMiseAJour() {
  try {
    const page = await fetch("./?verif=" + Date.now(), { cache: "no-store" }).then((r) => r.text());
    const enLigne = (page.match(/app\.js\?v=(\d+)/) || [])[1];
    if (!enLigne || enLigne === VERSION) return;
    if (document.querySelector("dialog[open]")) return; // ne pas interrompre une saisie
    if (sessionStorage.getItem("rechargePour") === enLigne) return;
    sessionStorage.setItem("rechargePour", enLigne);
    location.reload();
  } catch {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") verifierMiseAJour();
});
setTimeout(verifierMiseAJour, 5000);
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

  // Mode d'emploi : chargé seulement à la première ouverture.
  for (const bouton of document.querySelectorAll(".ouvrir-guide")) {
    bouton.addEventListener("click", () => {
      if (!$("cadre-guide").src) $("cadre-guide").src = "guide.html?v=16";
      $("fiche-guide").showModal();
    });
  }
  $("fermer-guide").addEventListener("click", () => $("fiche-guide").close());

  demarrerProgramme();
  demarrerTitresJours();
  $("version").textContent = "Version " + VERSION;
  demarrerRessources();
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
      afficherRessources();
    },
    (erreur) => signalerErreur($("etat-programme"), erreur)
  );

  const fiche = $("fiche-programme");
  const formulaire = $("formulaire-programme");

  $("ajouter-programme").addEventListener("click", () => ouvrirFiche(null));
  demarrerAjoutRapide(programme);
  for (const bouton of document.querySelectorAll("[data-vue]")) {
    bouton.addEventListener("click", () => {
      choisirVue(bouton.dataset.vue);
      window.scrollTo(0, 0);
    });
  }
  choisirVue(vueProgramme());
  $("annuler-programme").addEventListener("click", () => fiche.close());

  // « Retirer » ne supprime rien : l'idée va dans « Idées sans date, à placer », en bas du programme,
  // avec toutes ses informations. Son ancien jour est gardé dans « jourAvant » : il est
  // proposé par défaut quand on la remet au programme.
  $("retirer-programme").addEventListener("click", async () => {
    if (!ideeOuverte) return;
    fiche.close();
    try {
      await updateDoc(doc(programme, ideeOuverte.id), {
        jour: "", jourAvant: ideeOuverte.jour, modifiePar: moi(), modifieLe: serverTimestamp(),
      });
    } catch (erreur) {
      signalerErreur($("etat-programme"), erreur);
    }
  });

  // Suppression définitive : seulement pour une idée déjà « Idées sans date, à placer ».
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

// Pour comparer des noms sans tenir compte des majuscules ni des accents.
function nomSimplifie(nom) {
  return nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function afficherMessage(texte) {
  const message = $("message-programme");
  message.textContent = texte;
  message.hidden = false;
  clearTimeout(afficherMessage.minuteur);
  afficherMessage.minuteur = setTimeout(() => { message.hidden = true; }, 8000);
}

function demarrerAjoutRapide(programme) {
  const fiche = $("fiche-rapide");
  const formulaire = $("formulaire-rapide");
  const f = formulaire.elements;

  $("ajout-rapide-programme").addEventListener("click", () => {
    formulaire.reset();
    f.auteur.replaceChildren(...VOYAGEURS.map((p) => new Option(p, p)));
    f.auteur.value = moi();
    fiche.showModal();
  });
  $("annuler-rapide").addEventListener("click", () => fiche.close());

  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    // Virgules, points-virgules ou retours à la ligne séparent les noms.
    const deja = new Set(idees.map((i) => nomSimplifie(i.nom || "")));
    const nouveaux = [];
    const ignores = [];
    for (const morceau of f.noms.value.split(/[,;\n]+/)) {
      const nom = morceau.replace(/\s+/g, " ").trim().slice(0, 120);
      if (!nom) continue;
      if (nouveaux.some((n) => nomSimplifie(n) === nomSimplifie(nom))) continue; // tapé deux fois
      if (deja.has(nomSimplifie(nom))) { ignores.push(nom); continue; }
      nouveaux.push(nom);
    }
    if (nouveaux.length === 0 && ignores.length === 0) return;
    if (nouveaux.length > 40) {
      alert("C'est beaucoup d'un coup ! 40 noms au maximum par ajout.");
      return;
    }
    fiche.close();

    try {
      if (nouveaux.length) {
        const lot = writeBatch(db);
        for (const nom of nouveaux) {
          lot.set(doc(programme), {
            nom, type: f.type.value, jour: "", heure: "", statut: "a_reserver", etoile: false,
            prix: "", lien: "", note: "", auteur: f.auteur.value,
            modifiePar: moi(), creeLe: serverTimestamp(), modifieLe: serverTimestamp(),
          });
        }
        await lot.commit();
      }
      afficherMessage(
        (nouveaux.length ? `✅ ${nouveaux.length} ${nouveaux.length > 1 ? "cartes créées" : "carte créée"} dans « Idées sans date, à placer ».` : "Aucune carte créée.")
        + (ignores.length ? ` Déjà dans le programme : ${ignores.join(", ")}.` : "")
      );
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
    ? (JOURS.includes(i.jourAvant)
      ? "Le jour et l'heure d'avant sont déjà remplis. Touchez « Enregistrer » pour remettre l'idée à sa place, ou changez-les."
      : "Choisissez un jour (et une heure), puis « Enregistrer » : l'idée reprendra sa place dans le programme.")
    : "";
  f.nom.value = i.nom || "";
  f.type.value = TYPES[i.type] ? i.type : "visite";
  f.jour.value = JOURS.includes(i.jour) ? i.jour : JOURS.includes(i.jourAvant) ? i.jourAvant : "";
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
    ...JOURS.map((jour) => [jourLisible(jour), idees.filter((i) => i.jour === jour), jour]),
    ["Idées sans date, à placer", idees.filter((i) => !JOURS.includes(i.jour)), "sans-date"],
  ];

  for (const [titre, elements, repere] of groupes) {
    if (elements.length === 0) continue;
    const h3 = el("h3", "titre-jour");
    h3.id = "jour-" + repere;
    h3.append(el("span", "", titre));
    if (JOURS.includes(repere)) {
      if (titresJours[repere]) h3.append(el("span", "theme-jour", titresJours[repere]));
      const modifier = el("button", "modifier-titre", titresJours[repere] ? "✏️" : "✏️ Donner un titre");
      modifier.type = "button";
      modifier.setAttribute("aria-label", "Titre de la journée");
      modifier.addEventListener("click", () => ouvrirFicheJour(repere));
      h3.append(modifier);
    }
    liste.append(h3);
    for (const idee of elements.sort(ordre)) liste.append(carteIdee(idee));
  }
  afficherApercu(ordre);
}

/* ---------- Programme : titres des journées ---------- */

// Un document par journée (identifiant = la date), avec son titre : « Vatican »…
let titresJours = {};
let jourOuvert = null;

function ecouterTitresJours() {
  onSnapshot(
    collection(db, "voyages", code, "jours"),
    (resultat) => {
      titresJours = {};
      for (const d of resultat.docs) {
        if (JOURS.includes(d.id) && d.data().titre) titresJours[d.id] = d.data().titre;
      }
      afficherProgramme();
    },
    // En cas de refus (règles pas encore à jour) ou de coupure, on réessaie un peu plus tard :
    // une écoute en erreur ne se relance jamais toute seule.
    (erreur) => {
      console.warn("Titres des journées indisponibles", erreur);
      setTimeout(ecouterTitresJours, 20000);
    }
  );
}

function demarrerTitresJours() {
  ecouterTitresJours();

  const fiche = $("fiche-jour");
  const formulaire = $("formulaire-jour");
  $("annuler-jour").addEventListener("click", () => fiche.close());
  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const titre = formulaire.elements.titre.value.trim().slice(0, 60);
    const jour = jourOuvert;
    fiche.close();
    try {
      const reference = doc(db, "voyages", code, "jours", jour);
      if (titre) await setDoc(reference, { titre, modifiePar: moi(), modifieLe: serverTimestamp() });
      else await deleteDoc(reference);
    } catch (erreur) {
      signalerErreur($("etat-programme"), erreur);
    }
  });
}

function ouvrirFicheJour(jour) {
  jourOuvert = jour;
  $("date-fiche-jour").textContent = jourLisible(jour);
  $("formulaire-jour").elements.titre.value = titresJours[jour] || "";
  $("fiche-jour").showModal();
}

/* ---------- Programme : aperçu du séjour ---------- */

let filtreAReserver = false;

function vueProgramme() {
  return lire("vueProgramme") === "detail" ? "detail" : "apercu";
}

function choisirVue(vue) {
  ecrire("vueProgramme", vue);
  $("apercu-programme").hidden = vue !== "apercu";
  $("liste-programme").hidden = vue !== "detail";
  for (const bouton of document.querySelectorAll("[data-vue]")) {
    bouton.setAttribute("aria-pressed", String(bouton.dataset.vue === vue));
  }
}

// Bascule sur le détail et descend jusqu'à une journée ou une carte.
function allerAuDetail(idElement) {
  choisirVue("detail");
  const cible = $(idElement);
  if (!cible) return;
  cible.scrollIntoView({ behavior: "smooth", block: "start" });
  if (cible.classList.contains("carte")) {
    cible.classList.remove("surlignee");
    void cible.offsetWidth; // relance l'animation
    cible.classList.add("surlignee");
  }
}

function afficherApercu(ordre) {
  const apercu = $("apercu-programme");
  apercu.replaceChildren();
  if (idees.length === 0) return;

  const planifiees = idees.filter((i) => JOURS.includes(i.jour));
  const aReserver = planifiees.filter((i) => i.statut === "a_reserver");

  // Compteur des réservations : un toucher n'affiche qu'elles.
  const compteur = el("button", "compteur" + (filtreAReserver ? " actif" : ""));
  compteur.type = "button";
  if (filtreAReserver) {
    compteur.textContent = "✕ Revenir à tout le séjour";
  } else if (aReserver.length) {
    compteur.textContent = `🟠 ${aReserver.length} ${aReserver.length > 1 ? "réservations encore à faire" : "réservation encore à faire"} ›`;
  } else {
    compteur.textContent = "✅ Toutes les réservations sont faites";
    compteur.disabled = true;
  }
  compteur.addEventListener("click", () => {
    filtreAReserver = !filtreAReserver;
    afficherApercu(ordre);
  });
  apercu.append(compteur);

  for (const jour of JOURS) {
    const duJour = planifiees
      .filter((i) => i.jour === jour && (!filtreAReserver || i.statut === "a_reserver"))
      .sort(ordre);
    if (duJour.length === 0) continue;

    const bloc = el("section", "jour-apercu");
    const titre = el("button", "titre-apercu");
    titre.type = "button";
    const date = el("span", "date-apercu", jourLisible(jour));
    if (titresJours[jour]) date.append(el("span", "theme-jour", titresJours[jour]));
    titre.append(date, el("span", "fleche", "›"));
    titre.addEventListener("click", () => allerAuDetail("jour-" + jour));
    bloc.append(titre);

    const liste = el("ul", "liste-apercu");
    for (const idee of duJour) {
      const ligne = el("button", "ligne-apercu" + (idee.statut === "fait" ? " faite" : ""));
      ligne.type = "button";
      ligne.append(
        el("span", "heure-apercu", idee.heure ? idee.heure.replace(":", "h") : ""),
        el("span", "nom-apercu", idee.nom || "(sans nom)"),
        el("span", "reperes-apercu", (idee.etoile ? "⭐" : "") + (idee.statut === "a_reserver" ? "🟠" : idee.statut === "fait" ? "🟢" : ""))
      );
      ligne.addEventListener("click", () => allerAuDetail("idee-" + idee.id));
      const li = el("li");
      li.append(ligne);
      liste.append(li);
    }
    bloc.append(liste);
    apercu.append(bloc);
  }

  const sansDate = idees.filter((i) => !JOURS.includes(i.jour)).length;
  if (sansDate && !filtreAReserver) {
    const lien = el("button", "titre-apercu sans-date");
    lien.type = "button";
    lien.append(el("span", "", `💡 ${sansDate} ${sansDate > 1 ? "idées" : "idée"} sans date, à placer`), el("span", "fleche", "›"));
    lien.addEventListener("click", () => allerAuDetail("jour-sans-date"));
    apercu.append(lien);
  }
}

function carteIdee(idee) {
  const carte = el("article", "carte"
    + (idee.statut === "fait" ? " faite" : "")
    + (JOURS.includes(idee.jour) ? "" : " non-affectee"));
  carte.id = "idee-" + idee.id;

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

  if (!JOURS.includes(idee.jour) && JOURS.includes(idee.jourAvant)) {
    carte.append(el("p", "discret", "Prévu avant : " + jourLisible(idee.jourAvant)
      + (idee.heure ? " · " + idee.heure.replace(":", "h") : "")));
  }
  if (idee.prix) carte.append(el("p", "details", idee.prix));
  if (idee.note) carte.append(el("p", "note", idee.note));

  // Raccourci vers les articles et vidéos liés à cette visite.
  const nbRessources = ressources.filter((r) => r.visite === idee.id).length;
  if (nbRessources) {
    const voir = el("button", "lien-ressources",
      `📚 ${nbRessources} ${nbRessources > 1 ? "choses" : "chose"} à lire / à voir`);
    voir.type = "button";
    voir.addEventListener("click", () => ouvrirOnglet("ressources"));
    carte.append(voir);
  }

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

/* ---------- À lire / à voir ---------- */

const TYPES_RESSOURCE = {
  article: { icone: "📰", fait: "Lu" },
  video: { icone: "🎬", fait: "Vu" },
  livre: { icone: "📖", fait: "Lu" },
  podcast: { icone: "🎧", fait: "Écouté" },
};

let ressources = [];
let ressourceOuverte = null; // null = nouvelle ressource

function demarrerRessources() {
  const collectionRessources = collection(db, "voyages", code, "ressources");

  onSnapshot(
    collectionRessources,
    (resultat) => {
      $("etat-ressources").hidden = true;
      ressources = resultat.docs.map((d) => ({ id: d.id, ...d.data() }));
      afficherRessources();
      afficherProgramme();
    },
    (erreur) => signalerErreur($("etat-ressources"), erreur)
  );

  const fiche = $("fiche-ressources");
  const formulaire = $("formulaire-ressources");

  $("ajouter-ressources").addEventListener("click", () => ouvrirFicheRessource(null));
  $("annuler-ressources").addEventListener("click", () => fiche.close());

  $("supprimer-ressources").addEventListener("click", async () => {
    if (!ressourceOuverte) return;
    if (!confirm(`Supprimer « ${ressourceOuverte.titre} » pour toute la famille ?`)) return;
    fiche.close();
    try {
      await deleteDoc(doc(collectionRessources, ressourceOuverte.id));
    } catch (erreur) {
      signalerErreur($("etat-ressources"), erreur);
    }
  });

  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const f = formulaire.elements;
    const donnees = {
      type: f.type.value,
      titre: f.titre.value.trim(),
      lien: f.lien.value.trim(),
      note: f.note.value.trim(),
      visite: f.visite.value,
      modifiePar: moi(),
      modifieLe: serverTimestamp(),
    };
    if (!donnees.titre) return;
    fiche.close();
    try {
      if (ressourceOuverte) {
        await updateDoc(doc(collectionRessources, ressourceOuverte.id), donnees);
      } else {
        await addDoc(collectionRessources, { ...donnees, luPar: [], auteur: moi(), creeLe: serverTimestamp() });
      }
    } catch (erreur) {
      signalerErreur($("etat-ressources"), erreur);
    }
  });
}

// Les idées du programme dans l'ordre du voyage (les « Idées sans date, à placer » à la fin).
function ideesDansLOrdre() {
  return [...idees].sort((a, b) =>
    (JOURS.includes(a.jour) ? a.jour : "9").localeCompare(JOURS.includes(b.jour) ? b.jour : "9") ||
    (a.heure || "99").localeCompare(b.heure || "99") ||
    (a.nom || "").localeCompare(b.nom || "", "fr"));
}

function ouvrirFicheRessource(ressource) {
  ressourceOuverte = ressource;
  const f = $("formulaire-ressources").elements;
  const r = ressource || {};
  $("titre-fiche-ressources").textContent = ressource ? "Modifier" : "Nouvelle ressource";
  f.type.value = TYPES_RESSOURCE[r.type] ? r.type : "article";
  f.titre.value = r.titre || "";
  f.lien.value = r.lien || "";
  f.note.value = r.note || "";

  const choix = [new Option("Aucune (pour tout le voyage)", "")];
  for (const idee of ideesDansLOrdre()) {
    const jour = JOURS.includes(idee.jour) ? jourLisible(idee.jour).split(" ").slice(0, 2).join(" ") + " · " : "";
    choix.push(new Option(jour + (idee.nom || "(sans nom)"), idee.id));
  }
  f.visite.replaceChildren(...choix);
  f.visite.value = idees.some((i) => i.id === r.visite) ? r.visite : "";

  $("auteur-fiche-ressources").textContent = ressource?.auteur ? `Proposé par ${ressource.auteur}` : "";
  $("supprimer-ressources").hidden = !ressource;
  $("fiche-ressources").showModal();
}

async function basculerLu(ressource) {
  const dejaLu = (ressource.luPar || []).includes(moi());
  try {
    await updateDoc(doc(db, "voyages", code, "ressources", ressource.id), {
      luPar: dejaLu ? arrayRemove(moi()) : arrayUnion(moi()),
    });
  } catch (erreur) {
    signalerErreur($("etat-ressources"), erreur);
  }
}

function afficherRessources() {
  const liste = $("liste-ressources");
  if (!liste) return;
  liste.replaceChildren();

  if (ressources.length === 0) {
    liste.append(el("p", "vide", "Rien pour l'instant. Touchez « + Ajouter » pour partager un article, une vidéo ou un livre."));
    return;
  }

  // D'abord ce qui concerne tout le voyage, puis visite par visite dans l'ordre du programme.
  const parTitre = (a, b) => (a.titre || "").localeCompare(b.titre || "", "fr");
  const generales = ressources.filter((r) => !idees.some((i) => i.id === r.visite));
  if (generales.length) {
    liste.append(el("h3", "titre-jour", "Pour tout le voyage"));
    for (const r of generales.sort(parTitre)) liste.append(carteRessource(r));
  }
  for (const idee of ideesDansLOrdre()) {
    const liees = ressources.filter((r) => r.visite === idee.id);
    if (liees.length === 0) continue;
    liste.append(el("h3", "titre-jour", (TYPES[idee.type] || "📍") + " " + (idee.nom || "(sans nom)")));
    for (const r of liees.sort(parTitre)) liste.append(carteRessource(r));
  }
}

function carteRessource(ressource) {
  const type = TYPES_RESSOURCE[ressource.type] || TYPES_RESSOURCE.article;
  const luPar = (ressource.luPar || []).filter((p) => VOYAGEURS.includes(p));
  const jAiLu = luPar.includes(moi());
  const carte = el("article", "carte");

  const haut = el("div", "carte-haut");
  const ouvrir = el("button", "carte-titre");
  ouvrir.type = "button";
  ouvrir.append(el("span", "icone", type.icone), el("span", "", ressource.titre || "(sans titre)"));
  ouvrir.addEventListener("click", () => ouvrirFicheRessource(ressource));
  haut.append(ouvrir);
  carte.append(haut);

  if (ressource.note) carte.append(el("p", "note", ressource.note));

  const lien = lienSur(ressource.lien);
  if (lien) {
    const a = el("a", "lien-externe", "Ouvrir ↗");
    a.href = lien;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    carte.append(a);
  }

  const bas = el("div", "carte-bas");
  const lu = el("button", "statut " + (jAiLu ? "statut-fait" : "statut-libre"), (jAiLu ? "✅ " : "⬜ ") + type.fait);
  lu.type = "button";
  lu.setAttribute("aria-pressed", String(jAiLu));
  lu.addEventListener("click", () => basculerLu(ressource));
  const modifier = el("button", "bouton-modifier", "✏️ Modifier");
  modifier.type = "button";
  modifier.addEventListener("click", () => ouvrirFicheRessource(ressource));
  bas.append(lu, modifier);
  carte.append(bas);

  carte.append(el("p", "discret auteur",
    (luPar.length ? `${type.fait} par ${luPar.join(", ")}` : `Personne n'a encore ${type.fait === "Vu" ? "vu" : type.fait === "Écouté" ? "écouté" : "lu"}`)
    + (ressource.auteur ? ` · Proposé par ${ressource.auteur}` : "")));

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
