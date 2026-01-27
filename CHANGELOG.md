# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-01-28

All changes in this release were consolidated in **PR #1**.

### 🚴 Athlete-facing Improvements

- **Custom Template Support**: Added discovery and loading from local user directories, allowing for persistent athlete-specific workouts.
- **Enhanced CLI Tools**: Introduced `templates create` for scaffolding and `validate` for fail-fast schema checking.
- **Activity Deep-Dive**: Added the `activity` command with a `--laps` flag for detailed, lap-by-lap performance analysis.
- **FIT Export Improvements**: Fixed pool length calculation, interval step indexing, and step name inconsistencies for device exports.
- **Dynamic UI**: Added user-defined workout categories in `WorkoutModal`.

### 🧠 Training Intelligence

- **Intensity Parsing 2.0**: Refined parsing to accurately distinguish RPE ranges from explicit power/HR units (FTP, LTHR, LT) and percentages.
- **Robust Workout References**: Improved workout reference parsing to enforce sport prefixes and handle complex separators (fixing template ID extraction bugs).
- **Discrete Peak Tracking**: Rewrote historical strength queries to track distance and time-based peaks independently with accurate achievement dates.
- **Expanded Schemas**: Cleaned up sport values and enforced stricter validation on training plan schemas.

### 🛠 Developer & Architecture

- **Metadata Support**: Enhanced templates with richer metadata and inspectability.
- **Modular Refactor**: Broke down the monolithic `cli.ts` into clean, domain-specific modules.
- **CLI UI Utilities**: Implemented a centralized coloring system and table formatting utility for all CLI outputs.
- **Enhanced Dispatcher**: Improved command dispatching with better error handling and a default fall-through case.
- **Atomic Sync**: Implemented database transactions for Strava synchronization to ensure data integrity and massive performance gains.
- **Resilient API Handling**: Improved error logging for proxy configurations and ensured CLI progress bars always cleanup via `try/finally`.
- **Automated Validation**: Added the `fit-export-check` script to verify exported workout files against expected protocol.
- **Smarter Discovery**: Updated file discovery to use `lstatSync`, safely skipping symbolic links during template scans.
- **Unified Logging**: Fully migrated all commands and tests to a centralized `log` module.
- **Test Suite**: Added comprehensive CLI tests and fixed inconsistencies across the expanding test framework.
- **Docstrings**: Integrated automated, AI-assisted docstrings across core feature sets.

## [1.2.0] - 2026-01-20

### 🚴 Athlete-facing Improvements

- Initial support for Strava activity synchronization.

### 🧠 Training Intelligence

- Strength training historical peak reporting.
- Support for multiple sport types in training plans.

### 🛠 Developer & Architecture

- Various bug fixes in template loading and YAML parsing.
