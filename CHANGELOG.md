# Change Log

All notable changes to the "worktime" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [2.1.0]

- Version validation switched to Azure endpoint with clear rules:
  - Warn when a newer active version exists (with ~30-day grace period and download link).
  - Block when current version expired and a higher active exists (shows download link).
  - Allow when current is active and no higher active exists, or expired with no higher active.
  - Connection errors surface an explicit message to check connectivity (tracking requires Azure).
- Pre-checks before opening the webview: ensure repo is clean and last commit is authored by current Git user.
- Duplicate protection: local cache warns if the current commit was already tracked and lets you cancel or proceed.
- Tracking reliability: unified axios-based call with try/catch and clearer error messages (status, timeout, details).
- Webview UX/accessibility:
  - Star rating can be cleared (click selected star again or use new “Clear” action) and is keyboard/screen-reader friendly.
  - Hours input now has min/step and helper text; work item has pattern/maxlength with inline hint.
  - Shows short commit id; focuses work item; Enter key submits.
  - Toned down full-screen overlay for a more native feel.
- Refactor: modular src/ layout (services for version, git, tracking, state; UI for webview). Rollup now builds from `src/index.js` and copies UI assets from `src/ui`.

## [2.0.2]

- Increase limit of task lenght to 30

## [2.0.1-beta]

- Fix error that affect windows user with project path

## [2.0.1-alpha.1]

- Fix error that affect the hour spent inserted by a user
- Remove unused code

## [2.0.1-alpha.0]

- Added workspace selection
- Added check for git project

## [2.0.0-alpha]

### News

🥁🥁🥁 We made a big refactor on our plugin. Now the plugin is give you a better user interface, to be more confortable
to track your work

## [1.0.13]

- Added fix for wrong rating value

## [1.0.12]

- Added new metadata on the api call

## [1.0.11]

- Added new rating field, to get a rating from the user, on how good the use of copilot was

## [1.0.10]

- Added moment library to solve problem that affect date parsing for windows user

## [1.0.9]

- Solved a bug that affect the store of the data on for windows user

## [1.0.8]

- Solved a bug that affect the store of the data on the track file

## [1.0.7]

- Solved a bug that not permit the user to add the time when is inserted the first time

## [1.0.6]

- Solved a problem that affect windows OS user, when the plugin try to retrieve the project path

## [1.0.5]

- Added check fix url problem on windows OS

## [1.0.4]

- Added check for hours input
- Added trim on repo url

## [1.0.3]

- Added method to sanitize repourl

## [1.0.2]

- Added axios to handle curl on window system

## [1.0.1]

- Changed shortcut keybinding
- Added possibility to close the prompt on escape key press
- Changed method to retrieve branch name
- Added rollup to minify extension

## [1.0.0]

- Initial release
