# Automatic weekly indexing and deployment

The GitHub workflow `.github/workflows/update-search.yml` runs on a hosted Mac. Staff computers need only a browser. Search remains a static, client-side website; the hosted Mac is used only for maintenance.

## One-time setup

1. Commit this workflow, the application, and the incremental cache to the default branch. The cache ignore rules now include `cache/manifest.json`, `cache/issues/*.json`, and (after deployment) `cache/deployment.json`. Compiled Swift code, temporary files, browser state, and discovery snapshots stay ignored. No password is stored in these files. Use a private repository if the newspaper text should not be accessible through GitHub.
2. Keep the existing repository/site. In **Settings → Pages → Build and deployment → Source**, select **GitHub Actions**. The workflow publishes only the search files, arranged under `archive-search/public/` so the existing URL stays **https://oesterer.github.io/piedmontpost/archive-search/public/**. It does not upload the cache, maintenance scripts, or sample PDFs. Other repository-root content is not included in this Pages artifact.
3. In GitHub → repository **Settings → Secrets and variables → Actions**, add the **repository secret** `PIEDMONT_ARCHIVE_PASSWORD`, containing the Wix archive password. No personal access token, Cloudflare account, or hosting credentials are needed: Pages uses the workflow's built-in GitHub token and OIDC permissions. If you added `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, or the `CLOUDFLARE_PROJECT_NAME` variable for the earlier workflow, they can be removed.
4. Ensure GitHub Actions is enabled and repository policy allows the workflow's `contents: write` permission. It commits directly to the default branch. If branch protection prohibits that, arrange an explicit permitted automation identity or adapt this to a pull-request workflow before enabling the schedule; do not disable protections merely to make a failed push disappear.
5. Open **Actions → Update newspaper search → Run workflow** on the default branch. Leave **rebuild unchecked** and **deploy checked**. Ensure the `github-pages` environment allows deployment from the default branch without manual reviewer approval if scheduled updates should be unattended. Inspect the first run, confirm automatic Wix login works from GitHub, and test the published search.
6. Keep the existing search link or iframe in Wix. Its URL does not change.
7. Set maintainers' GitHub Actions notification preferences to receive workflow failures. The workflow produces a run summary but does not send custom email or Slack messages.

From a terminal, the initial commit can include:

```sh
git add .github archive-search
# Inspect staged filenames, including cache/manifest.json and cache/issues/*.json.
git diff --cached --stat
git commit -m "Automate weekly archive indexing and deployment"
git push
```

The cache is already populated locally. It must be committed before the first hosted run. Avoid uploading it manually through GitHub's web interface; use Git for the initial multi-file upload.

## Staff workflow

Upload the weekly PDF to Wix, update its dated archive link, and **publish** the Wix changes. No additional routine step is needed.

For an immediate update, open the bookmarked GitHub workflow and press **Run workflow**. This requires repository write access. Leave both defaults unchanged. The green run shows success; open its summary to see the latest indexed issue. A run on a non-default branch is skipped to protect production.

To test indexing without publishing, run manually with **deploy unchecked**. This saves verified cache and generated indexes in Git without deploying them. A later scheduled run detects the pending publication and deploys it. Configure Pages before leaving the schedule enabled.

## Why the Pages source changes

Commits pushed with a workflow's built-in `GITHUB_TOKEN` do not initiate GitHub's branch-based Pages build. Merely removing the Cloudflare steps and committing indexes would therefore leave the website stale. This workflow explicitly uploads a Pages artifact and calls `actions/deploy-pages`, using `pages: write` and `id-token: write`. Select **GitHub Actions** as the Pages source and remove/disable any separate old publishing workflow so two publishers cannot overwrite each other.

The artifact keeps the existing subdirectory layout. Uploading `public/` directly at the artifact root would instead move search to `/piedmontpost/`; this workflow deliberately preserves your current link. If you use a custom domain later, include its required Pages configuration in the artifact.

## Schedule

All cron times are UTC to work consistently across GitHub installations:

- Daily at 15:17 UTC: **08:17 PDT / 07:17 PST**, including Thursday's fallback check.
- Wednesdays at 16:17–23:17 UTC and Thursdays at 00:17–02:17 UTC: hourly from **09:17–19:17 PDT / 08:17–18:17 PST on Wednesday**.

Schedule times are approximate; GitHub may delay jobs. Change the cron entries if the release window differs. Public-repository schedules can be disabled after 60 days without repository activity; monitor this during publication breaks. Private hosted runner usage, especially macOS, can incur charges: set an appropriate GitHub billing budget.

## What each run does

- Checks out the latest default branch, including the durable per-issue cache.
- Installs Node dependencies and Playwright Chromium, and runs tests.
- Discovers online issues. Normal runs download/extract only new or missing PDFs. Optional **rebuild** refreshes every discovered issue and may take much longer.
- Regenerates quarterly/weekly indexes according to `settings.json` and verifies all published pages against the cache.
- Deploys only if the public files or deployment target differ from the last successful deployment. No-op polling preserves the manifest timestamp and creates no publication commit.
- Records a successful deployment and commits the cache, indexes, and deployment record back to the default branch. Human pushes affecting the public files or workflow also trigger an update (the push filter currently uses `main`; adjust it if your default branch differs). Bot commits use `GITHUB_TOKEN`, whose pushes do not trigger another workflow, so they cannot start an indexing loop.

`cache/deployment.json` stores a content checksum, the GitHub repository name, provider, and deployment time; it contains no token. A missing record causes a full initial deployment. Do not record it manually: it must describe an upload that actually succeeded. Changes to search JS/CSS also trigger deployment on the next run.

Only one update workflow runs at a time. Avoid committing to the default branch during an active update. If a concurrent human push makes the bot push fail, Git refuses it; no force push is used. Rerun against the latest branch. If deployment already succeeded, the next run may upload the same content again; this is safe.

## Failures and recovery

If some PDFs fail, verified progress is committed, the workflow ends red, and production is left unchanged. The next normal run retries the missing PDFs. A verification failure blocks both saving generated changes and deployment. If GitHub Pages deployment fails, the verified indexing progress is still committed, but its deployment checksum is not advanced: the next successful run retries publication even if there are no new issues.

If archive discovery fails, the existing production site remains available. Review the Actions log; a password change or a Wix layout change may require maintenance. Never expose the archive password or a GitHub token in a public "update" button.

Full rebuilds grow Git history. Weekly additions remain per-issue JSON files; never combine the cache into one oversized JSON file. Original PDFs and generated Swift binaries do not belong in the cache commit. Old content-hashed public index generations remain available for visitors with an older manifest.

## References

- [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Manual workflow runs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)
- [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
