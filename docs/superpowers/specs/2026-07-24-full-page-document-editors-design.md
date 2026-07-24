# Full-page billing and quotation editors

## Goal

Replace the click-to-dismiss overlay used to create and edit billings and quotations with dedicated, addressable editor pages. This prevents accidental loss of work when users click outside the form.

## Routes and navigation

- Add `/billing/new` and `/billing/$id/edit` for billing creation and editing.
- Add `/quotation/new` and `/quotation/$id/edit` for quotation creation and editing.
- The existing list pages stay at `/billing` and `/quotation`.
- Each Create button navigates to its corresponding `new` route. Selecting a document row navigates to that document's `edit` route.
- The full-page editor header shows the document type and mode, plus a Back/Cancel action that returns to the relevant list. Browser back also works through normal route history.

## Components and data flow

- Keep `DocumentEditor` as the shared form for both document types.
- Replace modal state in `DocList` with route navigation.
- Introduce a page-level editor component or route wrapper that loads the selected document for edit mode, converts its stored item JSON into `EditorInitial`, and passes that data to `DocumentEditor`.
- Extend the persistence flow so saving an existing document updates that document instead of inserting a duplicate. Saving a new document inserts it as today.
- After a successful save, navigate back to the appropriate list and refresh its data through the existing query flow.
- Keep the existing PDF preview and download actions inside the editor.

## Error handling and edge cases

- If an edit route references a missing document or a record with malformed item JSON, show a clear in-page message and a route back to the list instead of rendering a broken form.
- Back/Cancel does not save or mutate data.
- No editor page uses a backdrop, outside-click handler, or automatic dismissal.

## Visual direction

Retain the product's existing restrained, light administrative interface. The editor becomes the main content surface beneath the standard sidebar and header, using the existing form controls, tables, and buttons; only the layout and navigation change.

## Validation

- Add Vitest and a browser-like test environment, then write focused tests for create navigation, edit navigation, and saving an existing document without creating a duplicate.
- Run lint and production build after implementation.
