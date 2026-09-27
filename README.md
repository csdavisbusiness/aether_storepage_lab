# Store Page Lab

An unofficial, static game store page mockup. Open `index.html` locally or host the repo with GitHub Pages. It does not connect to Steam.

## Add images

1. Put PNG, JPG, or WebP files in `assets/` (subfolders are supported).
2. In Command Prompt from the repo folder, run `py tools\build_assets.py`. If `py` is unavailable, try `python tools\build_assets.py`.
3. Commit both the images and the regenerated `assets/manifest.js`, then push. The page shows the gallery automatically. An image with `capsule`, `header`, or `cover` in its filename is used in the right-hand capsule; the rest appear in the gallery. Rename files if you want a different sort order (e.g. `01-street.png`).

A static web page cannot list the contents of a folder at runtime. Regenerate the manifest whenever images change. Extra screenshot URLs entered in the page editor are browser-local additions.

## Demo download

Put a build such as `demo.zip` in `downloads/`, then set `demoUrl: 'downloads/demo.zip'` in the `defaults` object of `index.html`. The editor's demo URL field can preview the link locally, but browser-local edits are not published to other visitors. With no URL, the button says “Demo coming soon.” GitHub also permits linking to a release asset instead of committing a large build to the repo; set `demoUrl` to that full URL.

## News and updates

Add objects to the `window.STORE_UPDATES` array in `updates.js`, following the commented example. Use `date`, `title`, `author`, and `body`. Posts display newest first. This is a static developer-news feed styled like a discussion board; visitors cannot create accounts or post comments without a backend or third-party discussion service.

## Page copy

The page editor saves experiments in that browser's local storage. Set permanent defaults in the `defaults` object near the end of `index.html`. To see new repository defaults after an earlier edit, click **Reset sample text** on the page.
