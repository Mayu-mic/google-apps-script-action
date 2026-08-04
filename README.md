Google Apps Script Action
===

GitHub Actions for pushing, deploying, and versioning Google Apps Script projects with [clasp](https://github.com/google/clasp).

Version 3 is split into three JavaScript sub-actions. Clasp 3.x is downloaded at runtime, so the action does not require a Docker image or a globally installed clasp.

Usage
---

### Push

```yaml
- uses: Mayu-mic/google-apps-script-action/push@v3
  with:
    clasprc: ${{ secrets.CLASPRC_JSON }}
    scriptId: ${{ secrets.SCRIPT_ID }}
```

### Deploy

The deploy sub-action pushes the project first, then creates or updates a deployment.

```yaml
- uses: Mayu-mic/google-apps-script-action/deploy@v3
  id: deploy
  with:
    clasprc: ${{ secrets.CLASPRC_JSON }}
    scriptId: ${{ secrets.SCRIPT_ID }}
    deploymentId: ${{ secrets.DEPLOYMENT_ID }}
    description: "Production deployment"

- run: echo "Deployment ${{ steps.deploy.outputs.deploymentId }} uses version ${{ steps.deploy.outputs.versionNumber }}"
```

### Create a version

The version sub-action also pushes the project first. It exposes only the created version number.

```yaml
- uses: Mayu-mic/google-apps-script-action/version@v3
  id: version
  with:
    clasprc: ${{ secrets.CLASPRC_JSON }}
    scriptId: ${{ secrets.SCRIPT_ID }}
    description: "Release notes"

- run: echo "Created version ${{ steps.version.outputs.versionNumber }}"
```

Inputs
---

| Input | Push | Deploy | Version |
| --- | --- | --- | --- |
| `clasprc` | Required | Required | Required |
| `scriptId` | Required | Required | Required |
| `projectRootPath` | Optional | Optional | Optional |
| `sourceRootDir` | Optional | Optional | Optional |
| `appsscriptJsonPath` | Optional | Optional | Optional |
| `claspJsonTemplatePath` | Optional | Optional | Optional |
| `deploymentId` | — | Optional | — |
| `versionNumber` | — | Optional | — |
| `description` | — | Optional | Optional |

`sourceRootDir` is relative to `projectRootPath`. If `appsscriptJsonPath` is provided, that file is copied into the project before the clasp command runs. A template supplied through `claspJsonTemplatePath` is used as the starting point for the temporary `.clasp.json`.

Outputs
---

| Output | Push | Deploy | Version |
| --- | --- | --- | --- |
| `deploymentId` | — | Created deployment ID | — |
| `versionNumber` | — | Deployed version number, or an empty string when clasp does not return one | Created version number |

Migration from v2
---

Version 3 is a breaking change. The `command` input is removed. Use the `push`, `deploy`, or `version` sub-action under the `@v3` tag instead.

The existing `CLASPRC_JSON` secret can be reused without creating a new credential. Clasp 3.x can read the v2 `.clasprc.json` format, so the secret does not need to be regenerated.

The action creates `.clasp.json` in a temporary workspace, so `.clasp.json` does not need to be added to `.gitignore`. If `appsscriptJsonPath` is provided, the specified `appsscript.json` is copied into and overwrites the project file before the clasp command runs.

The `version` sub-action no longer declares or sets a `deploymentId` output. Clasp has also moved to the 3.x release line. TypeScript automatic transpilation was removed from clasp 3.x, so projects written in TypeScript must be bundled before they are pushed.

Before (v2):

```yaml
- uses: Mayu-mic/google-apps-script-action@v2
  id: release
  with:
    clasprc: ${{ secrets.CLASPRC_JSON }}
    scriptId: ${{ secrets.SCRIPT_ID }}
    command: version
    description: "Release notes"

- run: echo "Created version ${{ steps.release.outputs.versionNumber }}"
```

After (v3):

```yaml
- uses: Mayu-mic/google-apps-script-action/version@v3
  id: release
  with:
    clasprc: ${{ secrets.CLASPRC_JSON }}
    scriptId: ${{ secrets.SCRIPT_ID }}
    description: "Release notes"

- run: echo "Created version ${{ steps.release.outputs.versionNumber }}"
```

For a v2 deployment, replace `command: deploy` with `uses: Mayu-mic/google-apps-script-action/deploy@v3`. For a v2 push, replace `command: push` with `uses: Mayu-mic/google-apps-script-action/push@v3`.
