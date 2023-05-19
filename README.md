Google Apps Script Action
===

Github Action for pushing and deploying Google Apps Script projects using [clasp](https://github.com/google/clasp).

This action creates a `.clasp.json` file according to the input settings. Therefore, it is recommended that the original `.clasp.json` be added to `.gitignore`.

Inputs
---

### `clasprc`

**Required** Clasp configuration file.

### `scriptId`

**Required** Google Apps Script: Script ID

### `command`

**Required** Command to execute (push, deploy or version)

### `description`

Description of the deployment.

### `deploymentId`

Deployment ID

### `projectRootPath`

Project root path.

### `sourceRootDir`

Root directory of script source (relative to project root).

### `appsscriptJsonPath`

The path to appsscript.json. If specified, the file will be changed to the specified file when the command is executed.

### `claspJsonTemplatePath`

The path to the clasp.json template. If specified, .clasp.json will be created from this file.

Outputs
---

### `deploymentId`

Created deployment ID (when only deploy command)

### `versionNumber`

Created version number (when only deploy and version)

Example usage
---

### Push

```yaml
- uses: Mayu-mic/google-apps-script-action@v1
  with:
    clasprc: ${{ secrets.CLASPRC_JSON }}
    scriptId: ${{ secrets.SCRIPT_ID }}
    command: 'push'
```

### Deploy with deployment id and description

```yaml
- uses: Mayu-mic/google-apps-script-action@v1
  with:
    clasprc: ${{ secrets.CLASPRC_JSON }}
    scriptId: ${{ secrets.SCRIPT_ID }}
    command: 'deploy'
    deploymentId: ${{ secrets.DEPLOYMENT_ID }}
    description: 'Deployment description'
```

### Versioning Library

```yaml
- uses: Mayu-mic/google-apps-script-action@v1
  with:
    clasprc: ${{ secrets.CLASPRC_JSON }}
    scriptId: ${{ secrets.SCRIPT_ID }}
    command: 'version'
    sourceRootDir: 'src'
    description: 'Update features'
```
