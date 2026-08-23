# Filling what the tools already promised

Three defects were reported to me. **I verified all three before touching anything, and one
of them was not what it appeared to be.** What follows is what I measured, what I changed,
and what I could not close.

---

## 1. `npm run plan` returned nothing — confirmed, closed

Measured, not inferred:

    node src/carnet.ts   →  exit code 0, 0 bytes written

`src/carnet.ts` exported types, constants and functions and had **no command-line half at
all**: no `isMain`, no `console.log`. It could not print by construction.

**A published command that exits 0 in silence is worse than a missing one.** A missing
command fails loudly and the reader knows where they stand; this one returned success, so
nothing invited suspicion. The two lines a user actually saw were `npm notice`.

Closed by giving the module a CLI block. It prints both readings side by side — central and
high — and that choice is not cosmetic: **at the central estimate three of the four
orderings cost nothing and miss nothing.** A tool that printed only the central column would
reproduce, in itself, the exact flaw the file was written to expose.

## 2. Two generated blocks that nothing generated — confirmed, closed

`README.md` carried `<!-- figures:ordres -->` and `<!-- figures:provenance -->`, and nothing
reached either: no `figures` script in `package.json`, no importer of `src/figures.ts`, no
test that read the file.

**Every number in the orderings table was still correct when I checked it.** That is the
worse half of the finding, not the better one. A table that is right today and that nothing
re-derives is a table that will be wrong on the day the code changes, with no line turning
red and no reader able to tell.

`figures:provenance` was worse than stale: it was **written by hand underneath markers that
announce generation.** Its headers differed from what `markdown(INVENTAIRE, table)` produces
and it declared an extra **measured** kind — in a README that states, two sections lower,
that nothing in this repository is measured. The block contradicted the page that carried it.

Closed with `src/figures-readme.ts`: a generator plus `--check`, wired into `npm test`.
Proved in both directions — clean gives exit 0, a single falsified figure gives exit 1 and
names the block, regeneration returns to clean.

## 3. "A third of the money" — confirmed, closed by making it true

The sentence read: *Least slack first misses twice as many deadlines as shortest first and
costs a third of the money.*

Computed from the code:

    shortest first     3 missed   $1,580,000
    least slack first  6 missed   $  645,000     →  40.8 %

**"Twice as many" is exact.** "A third" is not: 40.8 % is seven and a half points away from
33.3 %, and the error runs in the direction that strengthens the argument — which is the
direction nobody ever audits.

It was not softened into "roughly a third". The sentence is now a generated block carrying
the numbers the code computes, comparison included. **Weakening a claim relieves its author
and gives the reader nothing.**

---

## What resists

**Nothing in this repository is measured, and the tools cannot fix that.** The findings are
a plausible inspection, the estimates are what an estimate looks like, the cost of a month
late is an order of magnitude. The generator makes the numbers *consistent with the code*;
it cannot make them *true of the world*, and the provenance block now says so without the
fabricated **measured** row that used to blur it.

**One idiom is weaker here than in the sibling repository.**
`src/gardiens.test.mjs:261` collapses a block comment to a single space:

    .replace(/\/\*[\s\S]*?\*\//g, " ")

`cascade/src/cascade.test.ts:1767` does the same job the right way:

    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))

The second preserves line count. The collapsing form is **harmless here** — this guard
concatenates files and counts tokens, it never reports a line number — but these guards are
copied between repositories, and the day someone adds a line number to it, every number it
prints will be wrong and its own exemption guards will test the wrong line. That failure was
paid this morning in a shared tool. The preserving form should be the one that travels.

---

## Verification

    npm test          30 tests, 30 pass, 0 fail
    npm run figures -- --check     up to date
    npm run plan      prints 8 findings, 4 orderings, both readings

The four modules that must stay byte-identical across repositories — `figures.ts`,
`interval.ts`, `provenance.ts`, `cli.ts` — were **not touched**, and were checked against
`~/Documents/cascade` after the work: all four match, md5 for md5.
