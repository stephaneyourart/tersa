# 2. Original Features

## AI Innovation & Orchestration
-   **Multi-Model Chaining**: Unique ability to chain outputs from one AI model (e.g., GPT-4 for text) directly as inputs for another (e.g., Flux for images, then Runway/Luma for video) within a single visual interface.
-   **Hybrid Local/Cloud Workflow**: Seamless integration of local resources (hardware, file system) with cloud-based AI inference, solving the "silo" problem of web-only AI tools.

## Specific UX (User Experience)
-   **Infinite Canvas with "Smart" Scroll**: A Figma-like infinite canvas where scrolling zooms by default, but switches to internal content scrolling when a specific node is selected (clicked). This resolves the conflict between navigating a large workspace and editing granular content.
-   **Visual Collections**: A dedicated "Collection Node" that aggregates multiple media outputs visually, allowing for bulk actions, comparison, and organization without cluttering the workspace.
-   **Dynamic Contextual Menus**: Context-aware toolbars that appear only on hover or selection, providing immediate access to relevant actions (upscale, variants, export) without menu diving.

## Pipeline I2V / Montage / Orchestration
-   **Direct DaVinci Resolve Bridge**: A proprietary Python bridge allows the web application to control DaVinci Resolve locally. It can import media, create folders, and even "spot" clips in the timeline based on web interactions.
-   **Metadata Preservation**: Unlike standard downloads, the pipeline preserves generation metadata (prompt, seed, model version) and injects it into the editing software as comments/notes, ensuring traceability of AI-generated assets.
-   **Batch Generation & Variants**: Integrated tools to launch parallel generation tasks (batch) and visually compare variants side-by-side.

