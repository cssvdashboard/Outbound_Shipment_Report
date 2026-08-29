---
name: unreal-euw-builder
description: >-
  Automated creation, dark DCC visual styling, compilation, package persistence,
  and tab management for Unreal Engine 5.7 Editor Utility Widget (EUW) Blueprints
  using Python API (`unreal.EditorUtilityWidgetBlueprintFactory`,
  `unreal.EditorUtilityLibrary.add_source_widget`,
  `unreal.BlueprintEditorLibrary.compile_blueprint`, and `unreal.EditorUtilitySubsystem`).
---

# Unreal Engine EUW Builder & Dark DCC Styling Skill

## Overview
This skill provides standardized python procedures to programmatically generate, populate, style, compile, save, and launch **Unreal Editor Utility Widget (EUW)** Blueprints without causing Unreal Editor instability or blank widget panels.

## Key Capabilities & Workflows

### 1. Creating or Loading EUW Assets
- Uses `unreal.EditorUtilityWidgetBlueprintFactory` to instantiate clean `EditorUtilityWidgetBlueprint` assets under `/Game/VRTX/EUW_VRTX`.

### 2. Building the UMG Widget Hierarchy Programmatically
- Uses `unreal.EditorUtilityLibrary.add_source_widget(widget_blueprint, widget_class, widget_name, widget_parent_name)`:
  - Root widget created by passing `""` (empty string) as `widget_parent_name`.
  - Child panel widgets (`VerticalBox`, `HorizontalBox`, `Border`, `ScrollBox`) and leaf controls (`TextBlock`, `EditableTextBox`, `Button`) added by passing parent widget names.

### 3. Dark DCC Visual Styling
- Uses HSL/RGB tailored dark palette to avoid browser/default white styling:
  - **Window Background**: `LinearColor(0.04, 0.04, 0.05, 1.0)` (#0B0B0D)
  - **Header / Status Panel**: `LinearColor(0.08, 0.08, 0.11, 1.0)` (#14141C)
  - **Sidebar Background**: `LinearColor(0.06, 0.06, 0.08, 1.0)` (#0F0F14)
  - **Card / Control Background**: `LinearColor(0.12, 0.13, 0.16, 1.0)` (#1F2129)
  - **Prominent Electric Accent**: `LinearColor(0.02, 0.45, 0.90, 1.0)` (#0573E6)
  - **Readable Bright Text**: `LinearColor(0.95, 0.96, 0.98, 1.0)`
  - **Muted Secondary Text**: `LinearColor(0.60, 0.63, 0.68, 1.0)`
  - **Header Category Accent**: `LinearColor(0.35, 0.70, 1.00, 1.0)`

### 4. Blueprint Compilation & Package Persistence
- Calls `unreal.BlueprintEditorLibrary.compile_blueprint(bp)` to bake UMG widget bytecode into the asset.
- Calls `bp.modify()` and `unreal.EditorAssetLibrary.save_loaded_asset(bp)` / `unreal.EditorAssetLibrary.save_asset(asset_path)` to ensure `.uasset` disk persistence.
- Copies finalized `.uasset` to workspace content path `Content/VRTX/EUW_VRTX.uasset`.

### 5. In-Editor Tab Spawning
- Calls `unreal.get_editor_subsystem(unreal.EditorUtilitySubsystem).spawn_and_register_tab(bp)` to open dockable UI tab.

## Quick Start (Python Invocation)

```python
import launch_vrtx_ui
launch_vrtx_ui.launch()
```

## Common Mistakes & Troubleshooting
- **Blank EUW Panel**: Caused by missing `add_source_widget` calls or running headless compiler without compiling bytecode into `.uasset`. Always call `BlueprintEditorLibrary.compile_blueprint(bp)` and save the package.
- **Root Widget Parent Error**: Pass `""` (empty string) for `widget_parent_name` when creating the root widget; do NOT pass `None`.
- **Single-Child Content Widgets**: `UBorder` accepts only 1 child widget. Attach a `VerticalBox` or `HorizontalBox` to the `Border` first before adding multiple child widgets.
