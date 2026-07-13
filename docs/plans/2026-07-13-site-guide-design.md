# BenchAtlas Site Guide Design

## Decision

Add a dedicated, shareable `/guide/` page and expose it as `Guide` in the main-site header. A separate page is preferable to a modal because it does not cover the landscape, has a stable URL, and can be indexed and linked from external discussions.

## Content

The guide explains the product through its actual workflows: finding a benchmark, filtering the landscape by base model, selecting a protocol group, reading method notes, opening primary evidence, using the catalog and matrix, and interpreting the Reported Capability Ceiling. It explicitly distinguishes base models, public configurations, and reference entities.

The page uses the existing BenchAtlas visual language: black navigation, paper background, serif headings, monospace labels, compact borders, and the six-domain color system. Current result, model, benchmark, and report counts are loaded from the same index bundle as the main site so the guide does not become stale when data changes.

## Verification

Check the `/guide/` page at desktop and narrow widths, verify that the header link is visible on the main site, confirm all internal links resolve, and ensure the live count script reports the same values as the main page.
