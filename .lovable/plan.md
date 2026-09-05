# Admin Homepage Transactions Redesign

## Goal
Replace the current “Recent Transactions” list with the finance table shown in the supplied PDF, while preserving the existing admin authentication, dashboard metrics, charts, and kiosk tab.

## What will change
- Build a white, 12px-radius Transactions panel on the same light visual system as Enhanced Statistics.
- Add a sticky filter toolbar with:
  - wide search across system/payment reference, POS/Bank RRN, category name/code, kiosk, and mobile
  - All / Completed / Failed / Pending segmented status control
  - Date range, Kiosk, and Category dropdowns
  - Clear filters and live result count
- Add a filter-aware summary strip for Showing, Completed count and OMR total, Failed, Pending, and Success rate.
- Replace the current rows with compact zebra-striped rows, hover feedback, a sticky header, and date groups for Today, Yesterday, or the full date.
- Show human category titles from the categories data, with category codes beneath; show kiosk names as chips and online donations as a muted dash.
- Make Date & Time, Amount, and Status sortable from their column headers, with visible sort direction.
- Add 25-row pagination by default, page controls, and a rows-per-page selector.
- Open a right-side transaction drawer when a row is selected, showing amount, status, timestamps, references, RRN, auth code, TID/MID, category, kiosk, method/card, and receipt status.

## Technical details
- Extract the finance table into a focused admin component so the dashboard page remains maintainable.
- Load permitted transactions in batches rather than retaining the current 100-row cap; keep the existing 30-second refresh.
- Load kiosk and category reference data once and derive filter options, category names, totals, sorting, grouping, and pagination in the browser.
- Use Muscat time (GST, UTC+4) consistently for filters, groups, timestamps, and drawer details.
- Reuse the existing design-system inputs, selects, buttons, table, and side drawer; add transaction-page semantic color tokens matching the PDF (`#F4F6FA`, brand `#2563EB`, completed `#1F9D55`, failed `#DC3545`, pending `#C98A00`).
- Keep sensitive data inside the existing administrator-only access path and do not alter payment or reporting logic.

## Validation
- Verify search, every filter, clear filters, all three sortable columns, date grouping, pagination, row count changes, and drawer content.
- Check the dashboard at desktop and narrower widths, confirm sticky controls/header and horizontal table handling, and confirm no browser errors.
