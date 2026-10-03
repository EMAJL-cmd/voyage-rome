import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js?v=3";

const VOYAGEURS = ["Solange", "Emmanuelle", "Jean-Laurent", "Héloïse", "Thomas"];
const ONGLETS = ["programme", "ressources", "infos"];

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

if (code.length < 16) {
  $("lien-incomplet").hidden = false;
} else {
  // Base de données partagée du voyage : utilisée à partir de l'étape 4.
  const db = getFirestore(initializeApp(firebaseConfig));
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

  afficher();
}

function afficher() {
  const moi = lire("voyageur");
  const connu = VOYAGEURS.includes(moi);
  $("choix-voyageur").hidden = connu;
  $("application").hidden = !connu;
  if (connu) {
    $("prenom").textContent = moi;
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
