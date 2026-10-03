import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const etat = document.getElementById("etat");
const formulaire = document.getElementById("formulaire");
const champ = document.getElementById("champ");
const liste = document.getElementById("liste");

// Le code secret du voyage est la partie de l'adresse après « # ».
// Il n'est jamais envoyé à GitHub, seulement à la base de données.
const code = decodeURIComponent(location.hash.slice(1));
window.addEventListener("hashchange", () => location.reload());

function afficherEtat(texte, type) {
  etat.textContent = texte;
  etat.className = "etat " + type;
}

if (code.length < 16) {
  afficherEtat("Ce lien est incomplet. Demandez le lien complet à Emmanuelle.", "erreur");
} else {
  demarrer();
}

function demarrer() {
  const db = getFirestore(initializeApp(firebaseConfig));
  const messages = collection(db, "voyages", code, "test");

  onSnapshot(
    query(messages, orderBy("date", "desc"), limit(20)),
    (resultat) => {
      afficherEtat("✅ Connecté à la base partagée", "ok");
      formulaire.hidden = false;
      liste.replaceChildren();
      if (resultat.empty) {
        const vide = document.createElement("li");
        vide.className = "vide";
        vide.textContent = "Aucun message pour l'instant. Écrivez le premier !";
        liste.append(vide);
        return;
      }
      resultat.forEach((doc) => {
        const { texte, date } = doc.data();
        const li = document.createElement("li");
        const quand = document.createElement("span");
        quand.className = "quand";
        quand.textContent = date
          ? date.toDate().toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
          : "à l'instant";
        li.append(quand, document.createTextNode(texte));
        liste.append(li);
      });
    },
    (erreur) => {
      console.error(erreur);
      afficherEtat(
        erreur.code === "permission-denied"
          ? "La base refuse l'accès. Les règles de sécurité ne sont peut-être pas encore publiées."
          : "Impossible de joindre la base de données. Vérifiez votre connexion internet.",
        "erreur"
      );
    }
  );

  formulaire.addEventListener("submit", async (evenement) => {
    evenement.preventDefault();
    const texte = champ.value.trim().slice(0, 200);
    if (!texte) return;
    champ.value = "";
    try {
      await addDoc(messages, { texte, date: serverTimestamp() });
    } catch (erreur) {
      console.error(erreur);
      champ.value = texte;
      afficherEtat("Le message n'a pas pu être envoyé. Réessayez.", "erreur");
    }
  });
}
