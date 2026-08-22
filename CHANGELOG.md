# Changelog

All notable changes to the CueMap TypeScript SDK will be documented in this file.

## [0.7.2] - 2026-07-18

### Added
- Repository directory previews that enumerate supported top-level paths without ingesting file contents.
- Persistent include-path support plus helpers to read and update a project's saved filesystem ingestion scope.
- Embedded-engine stdout/stderr capture in `~/.cuemap/server.log`, with `CUEMAP_LOG_PATH` and `logPath` overrides.
- Semantic recall types now match the Rust engine's `lexical`, `semantic`, and `hybrid` modes, including optional precomputed query and memory embeddings.
- Added one-vector-per-produced-chunk `embeddings` for raw-content ingestion.
- Added `classifyIntent()` and typed query/memory intent responses.
- Updated release documentation for the qint8 MiniLM-L3 default and q4 MiniLM-L3 edge profile.

### Removed
- Removed CuePack request fields because CuePacks are no longer part of the v0.7.2 Rust API.

## [0.7.1] - 2026-07-17

### Changed
- Synchronized the SDK patch release with CueMap Engine v0.7.1.

## [0.7.0] - 2026-07-06

### Added
- **v0.7 Recall Controls**: Added object-style recall requests with `query_time`, `trace_timing`, `expansion_depth`, `cuepacks`, parent fusion, ordered reconstruction, evidence coverage, and CueBridge artifact controls.
- **v0.7 Ingestion Controls**: Added `sourceKey`, `structuralCues`, and segmenter configuration for raw content ingestion.
- **Batch Add API**: Added `addBatch()` for `/memories/batch`.
- **Project Artifact APIs**: Added helpers for project artifact summary/reload, project export, and watch directory ignored patterns/extensions.
- **Debug Analysis API**: Added `debugAnalyzeText()` for v0.7 cue extraction and chunking inspection.

### Changed
- **Memory IDs**: SDK types now accept numeric v0.7 memory IDs.
- **Alias Expansion Default**: `disableAliasExpansion` now defaults to `true`, matching the Rust engine default.
- **Removed Stale Endpoints**: Removed `contextExpand()` and `lexiconSynonyms()` because the v0.7 Rust engine no longer exposes those routes.

## [0.6.4] - 2026-03-04

### Added
- **Multi-Hop Recall**: `depth` parameter in recall requests to enable multi-hop associative retrieval.

## [0.6.3] - 2026-02-16

### Added
- **Optional alias expansion**: Added optional alias expansion to the SDK.

## [0.6.1] - 2026-01-21

### Added
- **Context Expansion**: New `contextExpand` method to retrieve related concepts from the cue graph.
- **Cloud Backup Management**: New methods (`backupUpload`, `backupDownload`, `backupList`, `backupDelete`) to manage cloud snapshots programmatically.

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
*Note: Version 0.7.0 is designed to work with CueMap Rust Engine v0.7.x.*
