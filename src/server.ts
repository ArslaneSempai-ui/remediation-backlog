/**
 * L'écran, servi depuis les sources.
 *
 * L'état est un ordre : une liste de références. Tout le reste s'en déduit — le calendrier
 * central, le calendrier pessimiste, ce qui tombe et ce que ça coûte. Rien n'est écrit sur
 * le disque : ce qu'un visiteur réarrange meurt avec son onglet.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { CARNET, EQUIPE, INVENTAIRE, POLITIQUES, capaciteParJour, planifier,
         type Equipe, type NomPolitique } from "./carnet.ts";
import { isMain } from "./cli.ts";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 4680);

/*
 * L'ordre de départ est le réflexe : le plus grave d'abord.
 *
 * C'est ce que fait une salle qui reçoit un rapport d'inspection, et c'est l'ordre que
 * l'outil montre comme le plus cher. Le lecteur arrive donc sur ce qu'il aurait fait.
 */
let ordre: string[] = POLITIQUES.graviteDabord(CARNET);
let equipe: Equipe = { ...EQUIPE };

export const BORNES = {
  personnes: [1, 20],
  joursParMoisEtParPersonne: [4, 21],
} as const;

function json(res: ServerResponse, corps: unknown, code = 200): void {
  const load = JSON.stringify(corps);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(load),
  });
  res.end(load);
}

function corps(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resoudre, rejeter) => {
    let brut = "";
    req.on("data", (b) => { brut += b; if (brut.length > 50_000) rejeter(new Error("request too large")); });
    req.on("end", () => { try { resoudre(brut ? JSON.parse(brut) : {}); } catch (e) { rejeter(e); } });
    req.on("error", rejeter);
  });
}

export function etat() {
  const centre = planifier(ordre, CARNET, equipe, "centre");
  const haut = planifier(ordre, CARNET, equipe, "haut");
  return {
    carnet: CARNET,
    inventaire: INVENTAIRE,
    ordre,
    equipe,
    bornes: BORNES,
    capacite: capaciteParJour(equipe),
    centre,
    haut,
    /* Les quatre ordres tout faits, chiffrés aux deux estimations : c'est la comparaison
     * que la salle croit avoir en tête et n'a jamais posée. */
    politiques: (Object.keys(POLITIQUES) as NomPolitique[]).map((nom) => {
      const o = POLITIQUES[nom](CARNET);
      return { nom, ordre: o,
        centre: planifier(o, CARNET, equipe, "centre"),
        haut: planifier(o, CARNET, equipe, "haut") };
    }),
  };
}

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(readFileSync(fileURLToPath(new URL("./ui.html", import.meta.url)), "utf8"));
      return;
    }
    for (const [chemin, type] of [["/graphes.js", "text/javascript"], ["/registre.css", "text/css"]] as const) {
      if (url.pathname === chemin) {
        res.writeHead(200, { "content-type": `${type}; charset=utf-8`, "cache-control": "no-store" });
        res.end(readFileSync(fileURLToPath(new URL("." + chemin, import.meta.url)), "utf8"));
        return;
      }
    }

    if (url.pathname === "/api/etat") return json(res, etat());

    /*
     * « Celui-ci, ensuite. »
     *
     * La commande d'une salle de remédiation n'est pas « réarrange-moi cette liste », c'est
     * « on prend lequel maintenant ». Une référence remonte donc en tête de ce qui n'a pas
     * encore été placé, et la séquence se construit clic après clic.
     */
    if (url.pathname === "/api/ensuite" && req.method === "POST") {
      const recu = await corps(req);
      const ref = String(recu.ref ?? "");
      if (ordre.includes(ref)) ordre = [ref, ...ordre.filter((r) => r !== ref)];
      return json(res, etat());
    }

    if (url.pathname === "/api/politique" && req.method === "POST") {
      const recu = await corps(req);
      const nom = String(recu.nom ?? "") as NomPolitique;
      if (nom in POLITIQUES) ordre = POLITIQUES[nom](CARNET);
      return json(res, etat());
    }

    if (url.pathname === "/api/equipe" && req.method === "POST") {
      const recu = await corps(req);
      const refuses: string[] = [];
      for (const [cle, [bas, haut]] of Object.entries(BORNES)) {
        /* LA CONVERSION PRÉCÉDAIT LA GARDE, ET LA GARDE NE GARDAIT RIEN.
           `Number("")` vaut 0, `Number(null)` vaut 0 : tous deux FINIS, donc acceptés,
           puis ramenés par le clamp sur la borne basse. Un champ vide se posait ainsi au
           bout du domaine avec un 200, et la valeur affichée n'était plus celle qu'on
           croyait lire. Le clamp n'était pas la parade : il était le masque.
           On refuse maintenant ce qui n'est pas un nombre, et on le DIT — un refus muet
           est le même défaut, remonté d'un étage. */
        if (!(cle in recu)) continue;
        const v = (recu as Record<string, unknown>)[cle];
        if (typeof v === "number" && Number.isFinite(v)) {
          (equipe as any)[cle] = Math.min(haut, Math.max(bas, v));
        } else {
          refuses.push(`${cle}=${JSON.stringify(v)}`);
        }
      }
      return json(res, { ...etat(), refuses });
    }

    res.writeHead(404).end("introuvable");
  } catch (e) {
    json(res, { erreur: String((e as Error).message ?? e) }, 400);
  }
});

/* La boucle locale, pas toutes les interfaces. */
if (isMain(import.meta)) {
  serveur.listen(PORT, "127.0.0.1", () => {
    console.log(`The order is the plan → http://localhost:${PORT}`);
  });
}
