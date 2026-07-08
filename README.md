# BenchAtlas Static Deploy

This directory is ready for Cloudflare Pages, Vercel, Netlify, or any static file host.

## Files

- `index.html`: BenchAtlas MVP interface.
- `site_data.bundle.js`: bundled benchmark data loaded by `index.html`.
- `_headers`: Cloudflare Pages headers.

## Cloudflare Pages

1. Create a GitHub repository, for example `benchatlas`.
2. Commit the contents of this `deploy/` directory.
3. In Cloudflare Pages, create a project from that repository.
4. Use these settings:
   - Framework preset: `None`
   - Build command: empty
   - Build output directory: `/`
5. Add custom domains:
   - `benchatlas.cn`
   - `www.benchatlas.cn`

If the repository root contains this `deploy/` folder instead of the files directly, set the output directory to `deploy`.

## DNS

For Cloudflare DNS, add:

- `www` CNAME to the Pages hostname Cloudflare gives you.
- root domain `@` through Cloudflare Pages custom domain flow.

If your domain DNS is still at the registrar, either add the records there or move DNS hosting to Cloudflare.
