import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BORNES } from "./carnet.ts";

/*
 * LA PAGE ENGENDRÉE ET LE SERVEUR DOIVENT BORNER PAREIL.
 *
 * ─── LE DÉFAUT ───
 *
 * Le gestionnaire `/api/equipe` existait en deux exemplaires : dans le serveur et dans le
 * script engendré pour le navigateur. **Une seule des deux copies portait la correction.**
 *
 * Le serveur avait appris que `Number("")` vaut 0, donc qu'un champ vidé traversait
 * `Number.isFinite` et se faisait ramener par le clamp sur la borne basse — « le clamp n'était
 * pas la parade, il était le masque ». La copie du navigateur, elle, faisait encore exactement
 * ça : vider le champ « personnes » posait silencieusement l'équipe à 1, et tout le calendrier
 * affiché suivait, sans un mot.
 *
 * Et les BORNES elles-mêmes étaient écrites deux fois, avec les mêmes nombres. C'est cet accord
 * qui rendait la divergence future invisible : la prochaine modification d'un seul des deux
 * côtés aurait fait borner le navigateur et le serveur différemment.
 */

const SRC = fileURLToPath(new URL(".", import.meta.url));

test("les bornes n'ont qu'une source", () => {
  /*
   * Le motif cherche une DÉFINITION, pas une mention : `personnes:` suivi d'un crochet. Le
   * domaine a le droit de la porter, personne d'autre.
   */
  const fautifs: string[] = [];
  const fichiers = readdirSync(SRC).filter((n) => /\.(ts|mjs)$/.test(n) && !n.includes(".test."));
  assert.ok(fichiers.length >= 5, `${fichiers.length} fichier(s) lus : le relevé ne lit rien.`);
  for (const nom of fichiers) {
    if (nom === "carnet.ts") continue;
    if (/personnes:\s*\[/.test(readFileSync(SRC + nom, "utf8"))) fautifs.push(nom);
  }
  assert.deepEqual(fautifs, [],
    `${fautifs.join(", ")} définit les bornes une seconde fois. Deux définitions des mêmes `
    + "nombres s'accordent le jour où on les écrit et divergent à la première modification — "
    + "et c'est l'accord d'aujourd'hui qui rend l'écart de demain invisible.");
});

/** Le gestionnaire du navigateur, extrait de la source qui l'ÉMET. */
function gestionnaireDuNavigateur(): (chemin: string, corps: Record<string, unknown>) => Promise<unknown> {
  const src = readFileSync(SRC + "pages.ts", "utf8");
  const debut = src.indexOf("window.LOCAL = async (chemin, corps) => {");
  assert.notEqual(debut, -1, "le gestionnaire n'est plus émis sous cette forme : ce cas ne lit rien.");
  const fin = src.indexOf("\nwindow.LOCAL_POSE", debut);
  assert.ok(fin > debut, "la fin du gestionnaire est introuvable.");
  const corpsTexte = src.slice(debut, fin);

  /* On rejoue le gestionnaire avec des dépendances muettes : ce qui est éprouvé ici est LA
     RÈGLE de validation, pas le calendrier qu'elle alimente. */
  const fabrique = new Function("BORNES", "etat", `
    let equipe = { personnes: 5, joursParMoisEtParPersonne: 10 };
    let window = {};
    ${corpsTexte}
    return window.LOCAL;
  `);
  return fabrique(BORNES, () => ({ equipe: "état" })) as never;
}

test("le navigateur REFUSE un champ vide au lieu de le poser sur la borne basse", async () => {
  /*
   * LE DÉFAUT D'ORIGINE, REJOUÉ. `Number("")` vaut 0, donc l'ancienne version acceptait la
   * chaîne vide, la clampait à 1 personne, et rendait un état où l'équipe avait changé sans
   * que personne ne l'ait demandé.
   */
  const local = gestionnaireDuNavigateur();
  const r = await local("/api/equipe", { personnes: "" }) as { refuses: string[] };
  assert.deepEqual(r.refuses, ['personnes=""'],
    "un champ vide doit être refusé ET nommé : un refus muet est le même défaut d'un étage "
    + `plus haut. Reçu : ${JSON.stringify(r.refuses)}`);
});

test("un vrai nombre passe, et il est borné", async () => {
  /*
   * LE CONTRÔLE POSITIF. Sans lui, le cas ci-dessus passerait aussi si le gestionnaire
   * refusait TOUT — la façon la plus simple de rendre un cas vert sans rien garder.
   */
  const local = gestionnaireDuNavigateur();
  const dedans = await local("/api/equipe", { personnes: 7 }) as { refuses: string[] };
  assert.deepEqual(dedans.refuses, [], "un nombre valide ne doit pas être refusé.");

  const trop = await local("/api/equipe", { personnes: 9_999 }) as { refuses: string[] };
  assert.deepEqual(trop.refuses, [],
    "un nombre hors bornes est BORNÉ, pas refusé — c'est une valeur, pas une absence de valeur.");
  assert.ok(BORNES.personnes[1] < 9_999, "la borne haute doit être plus basse que l'essai.");
});
