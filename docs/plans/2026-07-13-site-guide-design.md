# BenchAtlas Site Guide Design

## Decision

Add dedicated, shareable English and Chinese pages at `/guide/` and `/guide/zh/`, and expose the guide as `Guide` in the main-site header. Separate pages are preferable to a modal because they do not cover the landscape, have stable URLs, and can be indexed and linked from external discussions.

## Content

The guide explains the product through its actual workflows: finding a benchmark, filtering the landscape by base model, selecting a protocol group, reading method notes, opening primary evidence, using the catalog and matrix, and interpreting the Reported Capability Ceiling. It explicitly distinguishes base models, public configurations, and reference entities.

Both language versions use one shared stylesheet and the existing BenchAtlas visual language: black navigation, paper background, serif headings, monospace labels, compact borders, and the six-domain color system. Current result, model, benchmark, and report counts are loaded from the same index bundle as the main site so the guide does not become stale when data changes.

## Verification

Check the `/guide/` page at desktop and narrow widths, verify that the header link is visible on the main site, confirm all internal links resolve, and ensure the live count script reports the same values as the main page.
