# SpentTime

[![License](https://img.shields.io/badge/License-MIT-yellowgreen.svg)](https://github.com/bartolo-amico/vscode-spentTime/blob/main/LICENSE.md) [![release](https://img.shields.io/badge/release-V2.1.1-red)](https://github.com/bartolo-amico/vscode-spentTime/releases/tag/v2.1.1) [![author](https://img.shields.io/badge/author-nexi%20digital-blue)](https://github.com/bartolo-amico)

This extension intends to give you a way to track the amount of time you spend in your projects.

It was created for internal use only, but you can contribute to improove with some cool stuff.

## Install

To install the extension:

1. Download the latest `.vsix` from the **Releases** section of this repository.
2. In VS Code, open the **Extensions** view (`CTRL+SHIFT+X`).
3. Click the three dots (`⋯`) in the top-right corner.
4. Choose **Install from VSIX...** and select the downloaded file.

## How to use

### Prerequisites

- Open a folder that is a valid **Git repository** in VS Code.
- Make sure your work is **committed** (no uncommitted changes).
- Ensure the **last commit** is authored by your current Git user (name/email in `git config`).
- You need an **active internet connection** so the extension can contact the tracking service.

### Tracking time for a commit

1. In VS Code, open the project you want to track.
2. Commit your work so the latest commit represents the work you’re logging.
3. Run the command:
   - From the **Command Palette** (`CTRL+SHIFT+P`) search for `Open SpentTime Box`, or
   - Use the default keybinding `ALT+CTRL+SHIFT+T` (Windows/Linux) or `ALT+CMD+SHIFT+T+S` (macOS).
4. If you have multiple workspace folders, select the correct **project** from the dropdown.
5. Check the **branch**, **commit ID**, **commit message**, and **author** shown in the Spent Time Box.
6. Enter:
   - The number of **hours** spent (in quarter-hour increments, e.g. `0.25`, `0.5`, `1.0`).
   - The **work item id** (e.g. a Jira ticket like `PRJ-1234`).
   - Optionally, a **rating** of how much AI tools supported you in this task (1–5 stars).
7. Click **OK** to validate and send the data.

If validation passes and the tracking service is reachable, you’ll see a confirmation message:
`Time spent successfully logged!`. The extension also remembers which commits were already tracked and
warns you if you try to track the same commit again.

## Issues

Feel free to report any issues [here](https://github.com/bartolo-amico/vscode-spentTime/issues).

Enjoy!

## Release Notes

You can view all the changelog release on the [CHANGELOG](CHANGELOG.md) file.

## License

[MIT](LICENSE.md)
