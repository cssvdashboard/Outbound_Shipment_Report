# Design Specification: Logistics & Shipping Intelligence Dashboard

**Date:** 2026-08-30  
**Status:** Approved by User  
**Author:** Technical Co-founder Agent & User  

---

## 1. Overview & Problem Statement
Operations and logistics management teams handle high volumes of weekly shipment records (~28,000 shipments per week in Excel format, such as `July Final Draft.xlsx`). The goal is to provide a modern, real-time analytics dashboard that transforms raw transaction rows into actionable operational insights:
- Shipper and customer performance analysis with keyword search & negative filtering ("Filter Out").
- Delivery timeline breakdown (`Within 4-5 Days` vs `More than 5 Days`).
- Final resolution distribution (`Delivered`, `RTS`, `NFBRK`, etc.).
- Tri-category delay bottleneck analysis (Transit Delays, Clearance Delays, Destination Delays).
- Country-level performance matrix (AWB count, Average TT, Min/Max TT, On-Time %).
- Multi-customer benchmark and comparison module for single or multi-destinations.
- Seamless weekly Excel file updates with local persistence.

---

## 2. Target Users & Use Cases
- **Operations Managers**: Track weekly delivery timeline adherence and transit bottlenecks.
- **Logistics & Customs Coordinators**: Isolate paperwork and clearance delays (e.g. invoice missing, importer number, inspection).
- **Account Managers & Executives**: Compare customer performance benchmarks and deliver reports.

---

## 3. Core Requirements & Features

### 3.1 Smart Shipper & Customer Filter Engine
- **Typeahead Keyword Search**: Typing `"Four"` or `"Elite"` dynamically finds all shippers containing that string.
- **Multi-Select Checkboxes**: Select one or multiple shippers/customers.
- **Dual Filter Modes**:
  - **Include Mode**: Filters to show only selected shippers.
  - **Filter Out (Exclude) Mode**: Hides selected shippers from the dashboard.
- **Quick Reset**: 1-click button to reset all active filters.

### 3.2 Executive KPI & Delivery Timeline
- **Summary Metrics**: Total AWBs, Average Transit Time (TT in days), Min TT, Max TT, On-Time Rate (< 5 days).
- **Delivery Timeline**: Donut chart & count/percentage breakdown for `Within 4-5 Days` vs `More Than 5 Days`.
- **Final Resolution**: Distribution of `Delivered`, `RTS`, `NFBRK`, `Undelivered`, `Lost`, `Destroyed`, `Seized`, `Re-route`, `Available For Pickup`.

### 3.3 Tri-Category Delay Hub
- **Transit Delays**: Breakdown by reason (`Transit Delay`, `US Transit Delay`, `CDG Transit Delay`, `Gateway Delay`, `Missort`, `Untraceable at MEMH/CDG`).
- **Clearance Delays**: Breakdown of 31+ customs reasons (`No Requirement`, `Manufacturer Name & Address`, `Invoice Missing`, `Clearance Authorization`, `Fabric Measurement`, etc.).
- **Destination Delays**: Breakdown of 11+ final mile delivery reasons (`Incorrect Address`, `Delay Attempt`, `Unable to Collect Payment`, `Business Closed`, `Refused by Consignee`, `Dispute POD`, etc.).
- **Drill-down**: Clicking any delay reason filters the shipment records.

### 3.4 Dynamic Country Performance Matrix
- Reactive table displaying: Country Code, Count of AWBs, Average TT (Days), Max TT (Days), Min TT (Days), On-Time Rate.
- Sortable headers, search filter, and reactive updates upon customer/shipper selection.

### 3.5 Multi-Customer Comparison Tool
- Select single destination country (e.g. US, DE, GB, CA, etc.) or all destinations.
- Select 2 or more customers to compare.
- Side-by-side metric cards (AWBs, Avg TT, Min/Max TT, On-Time %, Delay %) and comparative visual bar charts.

### 3.6 Shipment Explorer & Live Weekly Updates
- Paginated/virtualized table of raw shipment records with search and column sorting.
- 1-click Export to Excel (.xlsx) and CSV.
- Drag & drop weekly Excel updater with browser persistence in IndexedDB.
- Dark & Light mode toggle with sleek glassmorphic UI.

---

## 4. Architecture & Technical Decisions

| Decision | Selected Option | Rationale |
| :--- | :--- | :--- |
| **Tech Stack** | Vite + React 19 + TypeScript + Tailwind CSS | Fast compilation, modern UI ecosystem, reactive state |
| **Charts** | Chart.js & Lucide Icons | Smooth animations, high performance, customizable themes |
| **Excel Parser** | Web Worker + SheetJS (`xlsx`) | Parses 28k+ rows in background thread (<200ms) without UI lag |
| **Persistence** | IndexedDB | Caches updated weekly datasets locally in browser |
| **Theme** | Dark / Light Mode with CSS Variables | Modern glassmorphism aesthetic with enterprise readability |

---

## 5. Data Flow Diagram
```
[ Default July Data OR Uploaded Excel ] 
                 │
                 ▼
       [ Background Web Worker ] ──> Parses .xlsx into typed shipment objects
                 │
                 ▼
          [ IndexedDB ] ──> Stores active dataset locally
                 │
                 ▼
      [ In-Memory Aggregation ] ──> Sub-millisecond reactive filtering
                 ├──> Filter Engine (Include / Exclude Shippers & Customers)
                 ├──> Executive Overview & Delivery Timeline Donut
                 ├──> Tri-Category Delay Hub (Transit, Clearance, Destination)
                 ├──> Country Performance Matrix
                 ├──> Customer Benchmark Comparison Tool
                 └──> Shipment Explorer Table & Export
```

---

## 6. Verification & Quality Plan
- Verify exact count and percentage calculations against Excel `Summary` sheet pivot values.
- Verify sub-second search responsiveness on 28k records.
- Verify file dropzone with new Excel files.
- Verify Include and Exclude filter modes.
- Verify Dark and Light mode rendering.
