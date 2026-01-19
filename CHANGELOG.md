# Changelog

All notable changes to the CueMap TypeScript SDK will be documented in this file.

## [0.6.0] - 2026-01-19

### Added
- **Ingestion API**: New methods `ingestUrl`, `ingestContent`, and `ingestFile` for direct content ingestion.
- **Lexicon Management**: New methods (`lexiconWire`, `lexiconInspect`, `lexiconGraph`, `lexiconSynonyms`, `lexiconDelete`) for manual control over the engine's associative graph.
- **Job Status**: New `jobsStatus()` method to track background ingestion progress.
- **Brain Control Flags**: Added parameters to disable specific brain modules (`disablePatternCompletion`, `disableSalienceBias`, etc.) for deterministic debugging.

### Changed
- **BREAKING**: Refactored `recall` method signature. `queryText` is now the first argument, followed by `cues` and `projects`, to prioritize Natural Language Search.
  - Old: `client.recall(cues, limit, ...)`
  - New: `client.recall(queryText, cues, projects, limit)`
- **Documentation**: Updated README to reflect the "Brain-Inspired" architecture and new API surface.

## [0.5.0] - 2025-12-27

### Added
- **Search Metadata**: Support for retrieving `explain` data to understand why a memory was recalled.
- **Intersection Control**: Added `minIntersection` parameter to ensure high-precision results.
- **Auto-Reinforcement**: New `autoReinforce` flag to automatically strengthen memories upon recall.
- **Alias Support**: Native types and methods for managing semantic aliases.
- **Project Isolation**: Improved handling of multi-tenant environments through enhanced project context management.

### Changed
- **Type Definitions**: Updated all interfaces to match the v0.5 Rust engine output schema.
- **Normalization**: Aligned client-side cue normalization with the engine's deterministic logic.

### Fixed
- **Response Parsing**: Fixed issues with optional metadata fields in recall results.
- **CORS Support**: Improved headers for browser-based recall applications.

---

## [0.4.0] - 2025-11-22
### Added
- Improved React/Next.js integration hooks.
- Stable types for projects and taxonomies.

## [0.3.0] - 2025-10-18
### Added
- Support for Node.js and Browser-based environments.
- Basic authentication headers.

## [0.2.0] - 2025-09-10
### Added
- Enhanced TypeScript interfaces for search results.
- Automated client generation from engine schema.

## [0.1.0] - 2025-08-15
### Added
- Initial TypeScript client prototype.
- Memory ingestion and basic recall routines.

---
*Note: This version is designed to work with CueMap Rust Engine v0.6.x.*
