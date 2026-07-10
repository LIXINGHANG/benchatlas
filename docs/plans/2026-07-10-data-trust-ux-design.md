# BenchAtlas Data Trust UX

## Goal

Make it obvious which reported scores can be compared, why the same model may have multiple scores, and how every score connects to its evaluation setup and source.

## Data model

- Keep a canonical benchmark family and metric as the page identity.
- Treat harnesses, tools, source table labels, and other evaluation settings as protocol groups rather than separate benchmark pages.
- Preserve real benchmark versions such as DeepSWE 1.0 and DeepSWE v1.1 as separate families.
- Keep incomplete methodology source-scoped so it cannot silently enter a strict leaderboard.
- Store Method notes in six sections: setup, reasoning, agent/tools, dataset, runs/aggregation, and caveat.

## Interface

- Rank only rows in the selected protocol group.
- Show alternate reported setups for the selected model and allow direct switching.
- Display a provenance summary above Method notes.
- Show search result counts and retain benchmark/model matching.
- Explain Matrix selection and allow up to 12 models to be selected.
- Keep the 42-node landscape as a coverage-ranked overview and use Registry as the mobile default.

## Validation

- Confirm merged aliases no longer generate duplicate pages.
- Confirm protocol variants remain distinct comparison groups after page merging.
- Confirm structured Method notes contain no repeated exact sections.
- Test search, alternate report switching, Matrix selection, desktop layout, and mobile Registry behavior.
