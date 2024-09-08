# Changelog
All notable changes to this project will be documented in this file.

## Changelog format guideline
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### vMAJOR.MINOR.PATCH - YYYY-MM-DD

- Added new features.
- Changed existing functionality.
- Deprecated soon-to-be removed features.
- Removed features.
- Fixed bugs.
- Security in case of vulnerabilities.

## [BACKLOG]

### [MAJOR]

### [MINOR]

### [PATCH]

### [FUTURE]

## [IN-PROGRESS]

## [UNRELEASED]
- Added support for clearing local KV storage.

## v0.1.14 - 2024-09-06
- Finished queue and timer based key-value pair import.
- Fixed issue with batch processing where queue length was not decremented.
- Added more info to console logs.
- Limitation: Due to limited storage in localStorage not all logs are stored. Need to migrate to IndexedDB.

## v0.1.13 - 2024-09-05
- Started batched download of all key-value pairs.
- Fixed issue where key-value pair table didn't resize properly with window and table header scrolled below application toolbar.
- Refactored cloudflare.js to only pass apiKey and accountId once.
- Refactored KeyValuePairs.vue to use cloudflare.js, and implemented queue based key-value fetching.

## v0.1.12 - 2024-09-03
- Added progress indication when updating from toolbar, i.e. without a dialog.
- Added option for user to relaunch application after install is finished.
- Updated logs from updater.

## v0.1.11 - 2024-09-02
- Changed formatting of release notes in updater dialog.
- Added circular progress indicator in updater dialog during update download.
- Removed automatic update when update is available and user clicks updater button. Displaying updater doalog instead, until updater progress indication is implemented without dialog.

## v0.1.10 - 2024-09-01
- Added tooltip to app buttons.
- Changed key-value pair refresh button icon to cloud-sync.
- Disabled form elements and buttons when API key is invalid.
- Added error handling when fetching namespaceIds.

## v0.1.9 - 2024-09-01
- Fixed bug where app hangs and CPU usage spikes when clicking outside of dialogs due to event propagation not being stopped on click.
- Fixed issue where the available update was not downloaded and installed as expected.

## v0.1.8 - 2024-08-31
- Added release info to updater dialog: version, date, and release notes.
- Fixed issue where dark mode wasn't restored correctly.
- Added automatic check for updates on app start, also reflected in update button behaviour.
- Added support for download and install update when available.

## v0.1.7 - 2024-08-27
- Added CF worker namespace listing and selection.
- Removed manual namespaceId input in settings dialog.

## v0.1.6 - 2024-08-27
- Added option to manually check for app updates.
- Updated Tauri dependencies.
- Updated button icons.

## v0.1.5 - 2024-08-26
- Updated updater permissions.

## v0.1.4 - 2024-08-25
- Added cancel button to the settings dialog.
- Added button to toggle dark/light mode.
- Changed settings dialog to be modal.
- Added two-way binding for showing settings component.

## v0.1.3 - 2024-08-23
- Fixed updater related configuration

## v0.1.2 - 2024-08-23
- Added Tauri Updater plugin
- Fixed updater related configuration

## v0.1.1 - 2024-08-23
- Added Github Actions for build, sign and release on tag push.
- Updated dependencies.
- Updated `README.md` with more information.

## v0.1.0 - 2024-08-18
- Initial commit. Supports reading CF worker KV pairs.
