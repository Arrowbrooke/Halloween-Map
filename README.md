# ArrowBrooke Halloween Map

A separate, mobile-friendly neighborhood Halloween map. Residents can search and filter participating homes, get walking directions, share the map, and submit their own house. There are no crews, route trails, or visited/completed controls.

## Approval workflow

Every new house is saved with `approval_status = pending` and stays off the public map. The organizer reviews submissions in the Supabase Table Editor:

1. Open **Table Editor → stops**.
2. Filter `approval_status` to `pending`.
3. Check the address, map coordinates, categories, and notes.
4. Change the status to `approved` to publish it, or `rejected` to keep it hidden.

Only approved homes are requested by the public site. Residents cannot approve their own submissions.

## One-time setup

1. Create a new Supabase project for this site. Do not reuse the personal map's project.
2. Enable anonymous sign-ins under **Authentication → Sign In / Providers → Anonymous**.
3. Run `supabase-setup.sql` in the Supabase SQL Editor.
4. Copy the project's public URL and publishable key into `config.js`. Never place a secret or service-role key in the site.
5. Open `?demo=1` locally or on GitHub Pages to preview five sample homes without changing the database.

The neighborhood boundary and starting map position are in `config.js` and `app.js`. The event date is already set to October 31, 2026.

## GitHub Pages without a personal-name URL

Keep this code in a separate repository. For a neutral address, either:

- attach a custom domain to the repository's GitHub Pages settings; or
- publish it from a neutral GitHub organization, such as `arrowbrooke.github.io/halloween-map`.

GitHub Pages can enforce HTTPS after the custom domain is connected. Add the domain to the Pages settings before creating a `CNAME` file so GitHub records the correct DNS instructions.

## Privacy

Addresses and notes for approved homes are public to anyone with the link. The form tells residents to submit only a home they are authorized to list. Anonymous ownership lets a resident remove their approved home from the same browser, while the organizer can moderate every record in Supabase.
