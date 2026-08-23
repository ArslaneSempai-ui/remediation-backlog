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
import { CARNET, EQUIPE, INVENTAIRE, POLITIQUES, capaciteParJour, planifier } from "./js/carnet.js";

const BORNES = { personnes: [1, 20], joursParMoisEtParPersonne: [4, 21] };

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
    for (const [cle, bornes] of Object.entries(BORNES)) {
      const v = Number(corps[cle]);
      if (Number.isFinite(v)) equipe = { ...equipe, [cle]: Math.min(bornes[1], Math.max(bornes[0], v)) };
    }
    return etat();
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
