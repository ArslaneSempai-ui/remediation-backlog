/**
 * LE CARNET DE REMÉDIATION, ET POURQUOI C'EST CELUI-LÀ.
 *
 * Après une inspection, on reçoit une liste : des constats, une échéance par constat, et
 * une équipe pour les traiter. L'artefact habituel est un tableur à pastilles vertes et
 * rouges que tout le monde met à jour et dont personne ne peut rien déduire — parce qu'il
 * ne contient pas la seule chose qui décide : **l'ordre**.
 *
 * Deux constats ne s'exécutent pas en parallèle quand la même équipe les porte. Prendre le
 * plus grave d'abord est le réflexe, et c'est souvent celui qui fait tomber trois échéances
 * plus courtes qu'on aurait tenues. Ce fichier tient les constats, leur charge et leur
 * échéance ; l'ordre appartient au lecteur.
 *
 * ─── La charge est une fourchette, pas un nombre ───
 *
 * Un chiffrage de remédiation est une estimation, et tout le monde le sait en le donnant.
 * Le planifier comme un fait est le mensonge central de ces plans : la version centrale
 * tient toutes les échéances, la version pessimiste en fait tomber quatre, et le comité ne
 * voit jamais que la première. Chaque constat porte donc `bas`, `centre`, `haut`, et le
 * calendrier se lit deux fois.
 */

import type { Inventory } from "./provenance.ts";

export type Constat = {
  /** La référence du constat, telle qu'elle sort du rapport d'inspection. */
  ref: string;
  /** Ce qu'il faut faire, en une ligne. */
  quoi: string;
  /**
   * La charge en jours-personne : basse, centrale, haute.
   *
   * Trois nombres et pas un : c'est la seule façon honnête d'écrire une estimation, et la
   * différence entre les deux calendriers qu'on en tire est le résultat de l'outil.
   */
  charge: { bas: number; centre: number; haut: number };
  /** Jours ouvrés depuis le début du plan avant lesquels le constat doit être clos. */
  echeance: number;
  /**
   * Ce que coûte un dépassement, par mois de retard.
   *
   * Amende, remise en conformité, surveillance renforcée : un ordre de grandeur, jamais une
   * facture. C'est un nombre choisi, et le verdict bouge avec lui — l'écran le dit.
   */
  coutParMoisDeRetard: number;
  /** Vrai quand l'échéance a été prise devant le régulateur, pas fixée en interne. */
  engageDevantLeRegulateur: boolean;
};

export type Equipe = {
  /** Personnes affectées à la remédiation, à plein temps. */
  personnes: number;
  /** Jours ouvrés réellement disponibles par personne et par mois. */
  joursParMoisEtParPersonne: number;
};

/**
 * Le cas de référence.
 *
 * Huit constats, une équipe de trois, des échéances entre deux et douze mois. Les charges
 * et les échéances ressemblent à ce que produit une inspection de taille moyenne ; elles
 * sont inventées, et l'écran le dit.
 */
export const CARNET: Constat[] = [
  { ref: "F-01", quoi: "Rewrite the customer risk-scoring methodology",
    charge: { bas: 90, centre: 140, haut: 240 }, echeance: 260, coutParMoisDeRetard: 120_000,
    engageDevantLeRegulateur: true },
  { ref: "F-02", quoi: "Re-screen the existing book against the current sanctions list",
    charge: { bas: 30, centre: 45, haut: 70 }, echeance: 65, coutParMoisDeRetard: 250_000,
    engageDevantLeRegulateur: true },
  { ref: "F-03", quoi: "Evidence the four-eyes check on high-risk onboarding",
    charge: { bas: 12, centre: 20, haut: 34 }, echeance: 45, coutParMoisDeRetard: 60_000,
    engageDevantLeRegulateur: false },
  { ref: "F-04", quoi: "Close the transaction-monitoring alert backlog",
    charge: { bas: 55, centre: 80, haut: 130 }, echeance: 130, coutParMoisDeRetard: 180_000,
    engageDevantLeRegulateur: true },
  { ref: "F-05", quoi: "Retrain the first line on the new escalation rules",
    charge: { bas: 8, centre: 12, haut: 18 }, echeance: 40, coutParMoisDeRetard: 25_000,
    engageDevantLeRegulateur: false },
  { ref: "F-06", quoi: "Document the model validation that was never written up",
    charge: { bas: 15, centre: 25, haut: 45 }, echeance: 90, coutParMoisDeRetard: 40_000,
    engageDevantLeRegulateur: false },
  { ref: "F-07", quoi: "Reconcile beneficial-ownership data against the registry",
    charge: { bas: 40, centre: 65, haut: 110 }, echeance: 175, coutParMoisDeRetard: 90_000,
    engageDevantLeRegulateur: true },
  { ref: "F-08", quoi: "Replace the spreadsheet that tracks politically exposed persons",
    charge: { bas: 20, centre: 30, haut: 55 }, echeance: 220, coutParMoisDeRetard: 30_000,
    engageDevantLeRegulateur: false },
];

export const EQUIPE: Equipe = { personnes: 3, joursParMoisEtParPersonne: 16 };

/** Jours ouvrés que l'équipe produit par jour de calendrier ouvré. */
export function capaciteParJour(e: Equipe): number {
  /* Seize jours utiles par mois sur environ vingt-et-un jours ouvrés : le reste part en
   * réunions, en congés et en incidents. C'est une hypothèse, et elle est éditable. */
  return (e.personnes * e.joursParMoisEtParPersonne) / 21;
}

export type Ligne = {
  constat: Constat;
  /** Jour ouvré où le travail commence, l'équipe ne traitant qu'un constat à la fois. */
  debut: number;
  /** Jour ouvré où il se termine, sur l'estimation demandée. */
  fin: number;
  /** Jours de retard sur l'échéance ; zéro quand elle est tenue. */
  retard: number;
  /** Ce que ce retard coûte, au prix mensuel du constat. */
  cout: number;
};

export type Calendrier = {
  lignes: Ligne[];
  /** Jour ouvré où le dernier constat se termine. */
  fin: number;
  /** Nombre de constats en retard. */
  manques: number;
  /** Somme des coûts de retard. */
  cout: number;
  /** Manques portant sur une échéance engagée devant le régulateur. */
  manquesEngages: number;
};

/**
 * Le calendrier d'un ordre donné, sur une estimation donnée.
 *
 * L'équipe traite un constat à la fois : c'est la contrainte qui rend l'ordre décisif, et
 * c'est la réalité d'une petite équipe de remédiation — trois personnes sur huit chantiers
 * ne font pas huit chantiers en parallèle, elles font huit fois un chantier plus lentement.
 */
export function planifier(ordre: string[], carnet: Constat[], equipe: Equipe,
                          estimation: "bas" | "centre" | "haut"): Calendrier {
  const parRef = new Map(carnet.map((c) => [c.ref, c]));
  const cap = capaciteParJour(equipe);
  let curseur = 0;
  const lignes: Ligne[] = [];

  for (const ref of ordre) {
    const c = parRef.get(ref);
    if (!c) continue;
    const jours = c.charge[estimation] / Math.max(cap, 1e-9);
    const debut = curseur;
    const fin = curseur + jours;
    const retard = Math.max(0, fin - c.echeance);
    lignes.push({
      constat: c, debut, fin, retard,
      /* Le retard se facture au mois entamé : une remédiation en retard d'un jour est en
       * retard, et le régulateur ne compte pas en jours ouvrés. */
      cout: retard > 0 ? Math.ceil(retard / 21) * c.coutParMoisDeRetard : 0,
    });
    curseur = fin;
  }

  return {
    lignes,
    fin: curseur,
    manques: lignes.filter((l) => l.retard > 0).length,
    cout: lignes.reduce((s, l) => s + l.cout, 0),
    manquesEngages: lignes.filter((l) => l.retard > 0 && l.constat.engageDevantLeRegulateur).length,
  };
}

/** Les ordres qu'on prend sans y penser, chacun défendable en réunion. */
export const POLITIQUES = {
  /** Le plus grave d'abord : le réflexe, et rarement le bon. */
  graviteDabord: (c: Constat[]) => [...c].sort((a, b) => b.coutParMoisDeRetard - a.coutParMoisDeRetard).map((x) => x.ref),
  /** L'échéance la plus proche d'abord. */
  echeanceDabord: (c: Constat[]) => [...c].sort((a, b) => a.echeance - b.echeance).map((x) => x.ref),
  /** Le plus court d'abord : on vide la liste vite, ce qui plaît au comité. */
  plusCourtDabord: (c: Constat[]) => [...c].sort((a, b) => a.charge.centre - b.charge.centre).map((x) => x.ref),
  /**
   * La marge la plus faible d'abord.
   *
   * Marge = échéance moins charge : combien de jours on peut perdre avant de tomber. C'est
   * l'ordre que personne ne calcule et il bat les trois autres sur ce carnet.
   */
  margeDabord: (c: Constat[]) => [...c]
    .sort((a, b) => (a.echeance - a.charge.centre) - (b.echeance - b.charge.centre)).map((x) => x.ref),
} as const;

export type NomPolitique = keyof typeof POLITIQUES;

/** D'où vient chaque nombre. Publié tel quel dans le README. */
export const INVENTAIRE: Inventory = [
  { provenance: "assumed", name: "charge", what: "person-days per finding, low / central / high",
    note: "an estimate given as three numbers, because that is what an estimate is" },
  { provenance: "assumed", name: "echeance", what: "working days until the finding must be closed",
    note: "the ones committed to the regulator are marked; the others are internal" },
  { provenance: "chosen", name: "coutParMoisDeRetard", what: "cost of one month late, per finding",
    note: "fines, remediation and enhanced supervision, as an order of magnitude" },
  { provenance: "assumed", name: "equipe", what: "people on remediation and usable days a month",
    note: "sixteen usable days out of about twenty-one working ones" },
];
