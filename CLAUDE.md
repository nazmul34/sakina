# Sakina

## Branching strategy

This repo uses a **develop → main** flow. `develop` is the integration branch;
`main` is the released/production branch (one merge per completed epic).

Rules:

1. **Feature branches branch off `develop`** (e.g. `feat/...`, `fix/...`,
   `chore/...`), never off `main`.
2. **Feature PRs target `develop`**, never `main`.
3. **`main` is updated only via a PR from `develop`**, and only when an epic is
   complete. Never open a feature PR straight to `main`.
4. **No direct commits/pushes to `main` or `develop`** — all changes land through
   a reviewed, CI-passing PR.

CI (`.github/workflows/ci.yml`) runs on every PR and on pushes to both
`develop` and `main`.

### Merging & branch cleanup

Delete the source branch **per PR**, not repo-wide. Repo-wide auto-delete is
unsafe here because `develop` can't be protected on the free plan, so an epic
`develop → main` merge would try to delete `develop` itself.

- **Feature PR (`feat/... → develop`):** delete the branch after merge —
  `gh pr merge <PR#> --squash --delete-branch`, or click **Delete branch** in the UI.
- **Epic PR (`develop → main`):** merge **without** `--delete-branch` (don't click
  Delete branch) so `develop` is preserved.
  
### Enforcement

GitHub server-side branch protection / rulesets are paywalled on this repo
(private + free plan), so enforcement is local: a `pre-push` hook in
`.githooks/` rejects direct pushes to `main` and `develop`.

Enable it once per clone:

```sh
git config core.hooksPath .githooks
```

Emergency bypass: `git push --no-verify`. If the repo ever goes public or onto
GitHub Pro, add rulesets requiring a PR + passing CI on `main` and `develop`
for real server-side enforcement.
