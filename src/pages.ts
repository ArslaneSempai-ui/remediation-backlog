import { fileURLToPath } from "node:url";
/**
 * LA DÉMO PUBLIÉE.
 *
 * Le même `ui.html` sert ici et en local ; ce qui change est un shim qui répond aux mêmes
 * routes avec les mêmes formes. Le carnet, lui, est le même objet : il est compilé pour le
 * navigateur, pas recopié à la main dans une page.
 *
 * Pas d'accent grave dans le shim : il vit dans un gabarit.
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync } from "node:fs";
import { isMain } from "./cli.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

const SHIM = `<script>window.LOCAL_PRET = new Promise((r) => { window.LOCAL_POSE = r; });</` + `script>
<script type="module">
import { BORNES, CARNET, EQUIPE, INVENTAIRE, POLITIQUES, capaciteParJour, planifier } from "./js/carnet.js";


let ordre = POLITIQUES.graviteDabord(CARNET);
let equipe = { ...EQUIPE };

const etat = () => ({
  carnet: CARNET,
  inventaire: INVENTAIRE,
  ordre,
  equipe,
  bornes: BORNES,
  capacite: capaciteParJour(equipe),
  centre: planifier(ordre, CARNET, equipe, "centre"),
  haut: planifier(ordre, CARNET, equipe, "haut"),
  politiques: Object.keys(POLITIQUES).map((nom) => {
    const o = POLITIQUES[nom](CARNET);
    return { nom, ordre: o,
      centre: planifier(o, CARNET, equipe, "centre"),
      haut: planifier(o, CARNET, equipe, "haut") };
  }),
});

window.LOCAL = async (chemin, corps) => {
  if (chemin === "/api/etat") return etat();
  if (chemin === "/api/ensuite") {
    const ref = String(corps.ref || "");
    if (ordre.includes(ref)) ordre = [ref, ...ordre.filter((r) => r !== ref)];
    return etat();
  }
  if (chemin === "/api/politique") {
    const nom = String(corps.nom || "");
    if (POLITIQUES[nom]) ordre = POLITIQUES[nom](CARNET);
    return etat();
  }
  if (chemin === "/api/equipe") {
    /* LA CONVERSION PRECEDAIT LA GARDE, ET LA GARDE NE GARDAIT RIEN.
       Number("") vaut 0 : un champ vide etait FINI, donc accepte, puis ramene par le clamp
       sur la borne basse. Le clamp n etait pas la parade, il etait le masque — la valeur
       affichee n etait plus celle qu on croyait lire, et tout le calendrier suivait.
       Le serveur portait deja cette correction ; cette copie-ci ne l avait pas. On refuse ce
       qui n est pas un nombre, et on le DIT : un refus muet est le meme defaut d un etage
       plus haut. */
    const refuses = [];
    for (const [cle, bornes] of Object.entries(BORNES)) {
      if (!(cle in corps)) continue;
      const v = corps[cle];
      if (typeof v === "number" && Number.isFinite(v)) {
        equipe = { ...equipe, [cle]: Math.min(bornes[1], Math.max(bornes[0], v)) };
      } else {
        refuses.push(cle + "=" + JSON.stringify(v));
      }
    }
    return { ...etat(), refuses };
  }
  return {};
};

window.LOCAL_POSE && window.LOCAL_POSE();
` + "</" + "script>\n";

const BANNIERE = `<p class="renvoi" style="margin-bottom:1.5rem">
This runs entirely in your browser — no server, nothing uploaded. <b>Take a row</b> to move
that finding to the front and watch which deadlines fall. The findings, the estimates and
the deadlines are a plausible inspection, not a real one.
<a href="https://github.com/ArslaneSempai-ui/remediation-backlog">Source and method</a>.
</p>`;

export function construire(): void {
  const docs = root + "docs";
  mkdirSync(docs, { recursive: true });

  let html = readFileSync(root + "src/ui.html", "utf8");
  html = html.replace('href="/registre.css"', 'href="registre.css"');
  html = html.replace('from "/graphes.js"', 'from "./graphes.js"');
  html = html.replace('<script type="module">', SHIM + '<script type="module">');
  html = html.replace("<main>", "<main>\n" + BANNIERE);

  writeFileSync(docs + "/index.html", html);
  cpSync(root + "src/graphes.js", docs + "/graphes.js");
  cpSync(root + "src/registre.css", docs + "/registre.css");
  writeFileSync(docs + "/.nojekyll", "");
  console.log("docs/ built");
}

if (isMain(import.meta)) construire();
