# Taxonomy Review Workbench

## Purpose

Provide a local-first visual review surface for `benchmark_taxonomy.json`. Reviewers can inspect all normalized benchmark groups, move benchmark names between primary domains and subfields, record review status and notes, and export a patch without directly mutating the authority file.

## Data model

- `site_data.index.bundle.js` supplies the 401 normalized rank groups and embedded taxonomy.
- Review cards are grouped by `benchmark_name`, matching the key used by `benchmark_overrides`.
- A card records every linked `rank_group_key`, metric and variant so one move has predictable build semantics.
- Browser `localStorage` stores assignments, statuses and notes under the taxonomy schema version.
- Exported patches contain only changed overrides plus review metadata. The authority file remains unchanged until a separate, deliberate merge.

## Interface

- Left rail: six primary domains, nested subfields, counts and drop targets.
- Center board: subfield columns for the selected primary domain, with draggable benchmark cards.
- Right inspector: current and original classification, source, confidence, linked rank groups, editable domain/subfield, note and review status.
- Header: search, status/source filters, progress, undo, reset, import and export.

Moving a card onto a subfield changes its assignment. Moving it onto a primary domain uses that domain's default subfield. Inspector selects provide a non-drag alternative. All changes are reversible and persist locally.

## Patch contract

The exported `taxonomy_review_patch.json` includes:

- taxonomy schema version and catalog fingerprint;
- review summary;
- changed `benchmark_overrides` keyed by exact benchmark name;
- per-benchmark before/after values, status and reviewer note;
- review statuses for unchanged items, allowing progress to move between machines.

The validator rejects unknown domains/subfields, invalid confidence values, mismatched source domains and malformed review statuses.

## Verification

- Confirm 237 cards represent all 401 rank groups.
- Drag across subfields and primary domains and verify linked variants move together.
- Reload and verify local persistence.
- Export, validate and import the patch.
- Confirm reset restores the authority classification without editing the source taxonomy.
