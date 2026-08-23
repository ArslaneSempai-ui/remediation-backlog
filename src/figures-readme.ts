/**
 * THE README'S FIGURES, GENERATED FROM THE CODE THAT PRODUCES THEM.
 *
 * The two tables in `README.md` carried generation markers and nothing reached them: no
 * `figures` script, no importer of `figures.ts`, no test that read the file. Measured
 * before this module existed, every published number was still correct — and that is the
 * worse half of the finding, not the better one. A table that is right today and that
 * nothing re-derives is a table that will be wrong on the day the code changes, with no
 * line turning red and no reader able to tell.
 *
 * `figures:provenance` was worse than stale: it was written BY HAND underneath markers
 * that announce generation. Its headers differed from what `markdown(INVENTAIRE, table)`
 * produces and it carried an extra **measured** entry — in a repository whose own README
 * says, two sections lower, that nothing here is measured.
 *
 *   npm run figures            rewrite the blocks
 *   npm run figures -- --check report drift and exit non-zero   (wired into `npm test`)
 *
 * WHY THE READING SENTENCE IS A BLOCK TOO. It used to say the cheaper ordering "costs a
 * third of the money". The measured ratio is 40.8 %. A third is not a rounding of 40.8 —
 * it is three and a half points in the direction that strengthens the argument, which is
 * the direction nobody ever audits. The fix is not to soften the sentence into "roughly a
 * third": it is to let the sentence carry the number the code computes, so it cannot drift
 * again and cannot be rounded in a convenient direction by anyone, including its author.
 */

import { CARNET, EQUIPE, POLITIQUES, planifier, INVENTAIRE } from "./carnet.ts";
import type { NomPolitique } from "./carnet.ts";
import { table, run } from "./figures.ts";
import { markdown } from "./provenance.ts";
import { fileURLToPath } from "node:url";

/*
 * `fileURLToPath`, not `.pathname`. A file URL keeps its percent-encoding, so `.pathname`
 * hands `readFileSync` a path with `%20` in it and the read fails on any checkout whose
 * directory name contains a space or an accent. Ninety-one of these were swept out of the
 * sibling repository today; this is the ninety-second, and it was written by the person who
 * reported them.
 */
const README = fileURLToPath(new URL("../README.md", import.meta.url));

/**
 * The English name of each ordering, kept beside the code that names them in French.
 *
 * The table is read by a buyer and the policies are named by an engineer; the mapping has
 * to live somewhere, and here it is next to the only thing that renders it.
 */
const LABELS: Record<NomPolitique, string> = {
  graviteDabord: "Worst first",
  echeanceDabord: "Earliest deadline first",
  plusCourtDabord: "Shortest first",
  margeDabord: "Least slack first",
};

const money = (n: number): string => "$" + n.toLocaleString("en-US");

/** Both readings of one ordering: the central estimate, and the pessimistic one. */
function deuxLectures(nom: NomPolitique) {
  const ordre = POLITIQUES[nom](CARNET);
  return {
    nom,
    centre: planifier(ordre, CARNET, EQUIPE, "centre"),
    haut: planifier(ordre, CARNET, EQUIPE, "haut"),
  };
}

const lectures = (Object.keys(POLITIQUES) as NomPolitique[]).map(deuxLectures);

const ordres = table(
  ["Order", "Missed, central", "Cost, central", "Missed, high", "Cost, high"],
  lectures.map((l) => [
    LABELS[l.nom], l.centre.manques, money(l.centre.cout), l.haut.manques, money(l.haut.cout),
  ]),
);

/**
 * The sentence that reads the last two rows.
 *
 * Every number in it is computed, including the comparison itself. Writing "twice as many"
 * in prose would put the one claim most likely to rot back out of reach of the check: the
 * multiple holds today and holds only because of the numbers beside it.
 */
const court = lectures.find((l) => l.nom === "plusCourtDabord")!;
const marge = lectures.find((l) => l.nom === "margeDabord")!;
const part = (marge.haut.cout / court.haut.cout) * 100;

const lecture =
  `Read the last two rows together. **${LABELS.margeDabord} misses ${marge.haut.manques} ` +
  `deadlines against ${court.haut.manques}, and costs ${money(marge.haut.cout)} against ` +
  `${money(court.haut.cout)} — ${part.toFixed(1)} % of the money.** Counting red lines and ` +
  `counting money do not rank the same, and a tracker that counts red lines will recommend ` +
  `the expensive one.`;

run(README, {
  ordres,
  provenance: markdown(INVENTAIRE, table),
  lecture,
});
