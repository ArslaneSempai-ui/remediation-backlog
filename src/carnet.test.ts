/*
 * CE QUE CET OUTIL N'A PAS LE DROIT DE DIRE.
 *
 * Il produit un calendrier de remédiation et un montant de retard. Quatre façons de le
 * rendre malhonnête, dans l'ordre de ce qui coûterait le plus cher :
 *
 *  1. **Planifier sur l'estimation centrale et se taire.** C'est le mensonge du genre : un
 *     plan qui tient sur le chiffrage central et tombe sur le pessimiste, présenté comme un
 *     plan qui tient. L'outil doit produire les deux, toujours.
 *  2. **Compter les échéances manquées comme si c'était le score.** Six manques à 645 000 $
 *     valent mieux que trois à 1 580 000 $, et un tableau à pastilles dit l'inverse.
 *  3. **Traiter les constats en parallèle.** Trois personnes sur huit chantiers ne font pas
 *     huit chantiers en même temps. Si le modèle le permet, l'ordre cesse de décider et
 *     l'outil n'a plus d'objet.
 *  4. **Facturer un retard au prorata du jour.** Un régulateur ne compte pas en jours
 *     ouvrés : le mois entamé est dû.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { CARNET, EQUIPE, POLITIQUES, capaciteParJour, planifier } from "./carnet.ts";

const refs = CARNET.map((c) => c.ref);

test("l'équipe ne traite qu'un constat à la fois", () => {
  const p = planifier(refs, CARNET, EQUIPE, "centre");
  for (let i = 1; i < p.lignes.length; i++) {
    assert.ok(p.lignes[i]!.debut >= p.lignes[i - 1]!.fin - 1e-9,
      `${p.lignes[i]!.constat.ref} commence avant la fin du précédent : l'ordre ne déciderait plus rien`);
  }
  /* Et la durée totale est bien la somme des charges, pas moins. */
  const total = CARNET.reduce((s, c) => s + c.charge.centre, 0) / capaciteParJour(EQUIPE);
  assert.ok(Math.abs(p.fin - total) < 1e-6, `${p.fin} contre ${total}`);
});

test("l'ordre change le nombre d'échéances tenues, à travail identique", () => {
  /*
   * La raison d'être de l'outil. Même carnet, même équipe, même charge totale : seul
   * l'ordre bouge, et le résultat n'est pas le même. Si ce test tombe, il n'y a rien à
   * montrer.
   */
  const gravite = planifier(POLITIQUES.graviteDabord(CARNET), CARNET, EQUIPE, "centre");
  const echeance = planifier(POLITIQUES.echeanceDabord(CARNET), CARNET, EQUIPE, "centre");
  assert.equal(gravite.fin.toFixed(6), echeance.fin.toFixed(6), "les deux plans font le même travail");
  assert.ok(gravite.manques > echeance.manques,
    `le plus grave d'abord manque ${gravite.manques}, l'échéance d'abord ${echeance.manques}`);
});

test("le plan qui tient sur l'estimation centrale tombe sur la haute", () => {
  /*
   * Ce que le comité ne voit jamais. Sur ce carnet, l'ordre par échéance ne manque rien au
   * central et manque deux échéances au haut — dont le nombre exact importe moins que le
   * fait qu'il ne soit pas nul.
   */
  const ordre = POLITIQUES.echeanceDabord(CARNET);
  assert.equal(planifier(ordre, CARNET, EQUIPE, "centre").manques, 0);
  assert.ok(planifier(ordre, CARNET, EQUIPE, "haut").manques > 0,
    "aucune échéance ne tombe au pessimiste : le carnet ne démontre plus rien");
});

test("compter les manques et compter l'argent ne classent pas pareil", () => {
  /*
   * Le tableau à pastilles compte les rouges. Sur ce carnet, l'ordre par marge en produit
   * plus que l'ordre par plus-court-d'abord et coûte moins cher : la pastille et la facture
   * se contredisent, et c'est la facture qui paie.
   */
  const marge = planifier(POLITIQUES.margeDabord(CARNET), CARNET, EQUIPE, "haut");
  const court = planifier(POLITIQUES.plusCourtDabord(CARNET), CARNET, EQUIPE, "haut");
  assert.ok(marge.manques > court.manques, `marge ${marge.manques} contre court ${court.manques}`);
  assert.ok(marge.cout < court.cout, `marge $${marge.cout} contre court $${court.cout}`);
});

test("un retard se facture au mois entamé", () => {
  const un = CARNET[0]!;
  const carnet = [{ ...un, echeance: 1, charge: { bas: 1, centre: 1, haut: 1 } }];
  const p = planifier([un.ref], carnet, EQUIPE, "centre");
  /* Le travail dure moins d'un jour et l'échéance est à un jour : rien n'est dû. */
  assert.equal(p.cout, 0);

  const enRetard = [{ ...un, echeance: 0, charge: { bas: 1, centre: 1, haut: 1 } }];
  const q = planifier([un.ref], enRetard, EQUIPE, "centre");
  assert.equal(q.cout, un.coutParMoisDeRetard, "un jour de retard doit coûter un mois entier");
});

test("un ordre partiel ne fabrique pas de travail qui n'existe pas", () => {
  /* L'écran envoie l'ordre courant ; une référence inconnue ou un constat absent ne doit
   * pas allonger le plan en silence. */
  const p = planifier(["F-02", "INCONNU", "F-05"], CARNET, EQUIPE, "centre");
  assert.equal(p.lignes.length, 2);
  assert.deepEqual(p.lignes.map((l) => l.constat.ref), ["F-02", "F-05"]);
});

test("le réflexe est battu par un tri, sur les deux estimations", () => {
  /*
   * J'avais écrit ce test pour tenir la phrase « celui qui gagne au central n'est pas celui
   * qui gagne au haut ». Il a échoué du premier coup : sur ce carnet, l'ordre par échéance
   * gagne partout. La phrase était fausse et c'est le test qui l'a dit — donc il tient
   * maintenant ce qui est vrai, et qui suffit largement : prendre le plus grave d'abord,
   * qui est le réflexe de toutes les salles, coûte plus cher aux deux estimations qu'un
   * simple tri par échéance.
   */
  const argent = (nom: keyof typeof POLITIQUES, e: "centre" | "haut") =>
    planifier(POLITIQUES[nom](CARNET), CARNET, EQUIPE, e).cout;
  for (const e of ["centre", "haut"] as const) {
    assert.ok(argent("graviteDabord", e) > argent("echeanceDabord", e),
      `au ${e}, le plus grave d'abord ne coûte pas plus cher que l'échéance d'abord`);
  }
  /* Et l'écart n'est pas décoratif : il se compte en centaines de milliers. */
  assert.ok(argent("graviteDabord", "centre") - argent("echeanceDabord", "centre") > 100_000);
});

test("la capacité d'une équipe vide est nulle et ne divise pas par zéro", () => {
  const vide = { personnes: 0, joursParMoisEtParPersonne: 16 };
  assert.equal(capaciteParJour(vide), 0);
  const p = planifier(refs, CARNET, vide, "centre");
  assert.ok(Number.isFinite(p.fin), "un plan sans équipe doit rester un nombre, pas un infini");
  assert.equal(p.manques, CARNET.length, "sans personne, aucune échéance n'est tenue");
});
