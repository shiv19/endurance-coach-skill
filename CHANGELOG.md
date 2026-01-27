# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-01-28

All changes in this release were consolidated in **PR #1**.

### Template System & Engine

- **Custom Template Support**: Added discovery and loading from local user directories, allowing for persistent athlete-specific workouts.
- **Enhanced CLI Tools**: Introduced `templates create` for scaffolding and `validate` for fail-fast schema checking.
- **Metadata Support**: Enhanced templates with richer metadata and inspectability.
- **Intensity Parsing 2.0**: Refined parsing to accurately distinguish RPE ranges from explicit power/HR units (FTP, LTHR, LT) and percentages.
- **Robust References**: Improved workout reference parsing to enforce sport prefixes and handle complex separators (fixing template ID extraction bugs).

### CLI & Architecture

- **Modular Refactor**: Broke down the monolithic `cli.ts` into clean, domain-specific modules.
- **Pro UI Utilities**: Implemented a centralized coloring system and table formatting utility for all CLI outputs.
- **Enhanced Dispatcher**: Improved command dispatching with better error handling and a default fall-through case.

### Strava & Performance

- **Activity Deep-Dive**: Added the `activity` command with a `--laps` flag for detailed, lap-by-lap performance analysis.
- **Atomic Sync**: Implemented database transactions for Strava synchronization to ensure data integrity and massive performance gains.
- **Resilient API Handling**: Improved error logging for proxy configurations and ensured CLI progress bars always cleanup via `try/finally`.

### Hardware & Export

- **FIT Export Improvements**: Fixed pool length calculation, interval step indexing, and step name inconsistencies for device exports.
- **Automated Validation**: Added the `fit-export-check` script to verify exported workout files against expected protocol.

### Training Analytics

- **Discrete Peak Tracking**: Rewrote historical strength queries to track distance and time-based peaks independently with accurate achievement dates.
- **Expanded Schemas**: Cleaned up sport values and enforced stricter validation on training plan schemas.

### Web Viewer & UX

- **Dynamic UI**: Added a dynamic category option to `WorkoutModal` for user-defined workout classifications.
- **Smarter Discovery**: Updated file discovery to use `lstatSync`, safely skipping symbolic links during template scans.

### Maintenance & Testing

- **Unified Logging**: Fully migrated all commands and tests to a centralized `log` module.
- **Test Suite**: Added comprehensive CLI tests and fixed inconsistencies across the expanding test framework.
- **Docstrings**: Integrated CodeRabbit-generated docstrings across the core feature sets for better maintainability.

## [1.2.0] - 2026-01-20

### Added

- Initial support for Strava activity synchronization.
- Strength training historical peak reporting.
- Support for multiple sport types in training plans.

### Fixed

- Various bug fixes in template loading and YAML parsing.
