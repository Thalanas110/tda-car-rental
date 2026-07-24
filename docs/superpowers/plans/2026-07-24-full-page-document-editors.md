# Full-page document editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move billing and quotation creation and editing from dismissible overlays to dedicated full-page routes without changing the shared form fields or PDF tools.

**Architecture:** Four file-based TanStack routes will render a shared `DocumentEditorPage`, which loads an existing record only in edit mode and returns to its document list after save or cancel. `DocList` becomes navigation-only, while `DocumentEditor` decides whether to insert or update using an optional record ID.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript, Tailwind CSS, sql.js/localStorage, Vitest, React Testing Library.

## Global Constraints

- Keep the existing light administrative interface, sidebar, form controls, line-item table, and PDF preview/download behavior.
- Use `/billing/new`, `/billing/$id/edit`, `/quotation/new`, and `/quotation/$id/edit` as the only editor URLs.
- Save returns to the relevant list; Cancel/Back changes no data; no editor page may use a backdrop or outside-click dismissal.
- A malformed `items_json` value or missing record must render a clear in-page recovery state with a route back to the relevant list.
- Do not hand-edit `src/routeTree.gen.ts`; let the TanStack Vite plugin regenerate it.

## File structure

| File | Responsibility |
| --- | --- |
| `package.json` | Add repeatable Vitest scripts and test-only dependencies. |
| `vite.config.ts` | Configure jsdom and the shared test setup. |
| `src/test/setup.ts` | Register DOM matchers for component tests. |
| `src/lib/document-editor-data.ts` | Convert a stored `DocRow` into valid `EditorInitial` data and reject malformed item JSON. |
| `src/lib/db.ts` | Load one record and update an existing record while retaining the insert API. |
| `src/components/DocumentEditor.tsx` | Save new records or update existing records based on `documentId`. |
| `src/components/DocumentEditorPage.tsx` | Full-page create/edit shell, client-side record loading, recovery state, and list navigation. |
| `src/components/DocList.tsx` | Navigate to dedicated create/edit routes; remove all dialog state and markup. |
| `src/routes/billing.new.tsx`, `src/routes/billing.$id.edit.tsx` | Billing create and edit route definitions. |
| `src/routes/quotation.new.tsx`, `src/routes/quotation.$id.edit.tsx` | Quotation create and edit route definitions. |
| `src/**/*.test.ts(x)` | Regression coverage for conversion, save mode, and list navigation. |

---

### Task 1: Establish the test harness

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`

**Interfaces:**
- Produces the `npm run test` command and a jsdom environment for Tasks 2-4.

- [ ] **Step 1: Add the test dependencies and scripts**

Run:

```powershell
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom
```

Add these scripts to `package.json`:

```json
"test": "vitest run --passWithNoTests",
"test:watch": "vitest"
```

- [ ] **Step 2: Configure Vitest and DOM matchers**

Change the Vite config import and add the `test` block:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tanstackStart({ server: { entry: "server" } }),
    nitro({ preset: "cloudflare-module" }),
    viteReact(),
    tailwindcss(),
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Verify the test runner is available**

Run: `npm run test`

Expected: Vitest exits successfully and reports no test files yet.

- [ ] **Step 4: Commit the harness**

```powershell
git add package.json package-lock.json vite.config.ts src/test/setup.ts
git commit -m "test: add Vitest component test harness"
```

### Task 2: Add safe stored-document conversion and database update support

**Files:**
- Create: `src/lib/document-editor-data.ts`
- Create: `src/lib/document-editor-data.test.ts`
- Modify: `src/lib/db.ts`

**Interfaces:**
- Consumes: `DocRow` and `Item` from `src/lib/db.ts`.
- Produces: `EditorInitial`, `toEditorInitial(row): EditorInitial | null`, `getDoc(id): Promise<DocRow | undefined>`, and `updateDoc(id, draft): Promise<void>`.

- [ ] **Step 1: Write the failing conversion tests**

Create `src/lib/document-editor-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { DocRow } from "./db";
import { toEditorInitial } from "./document-editor-data";

const row: DocRow = {
  id: 7,
  doc_type: "billing",
  doc_date: "14 June 2026",
  billed_to: "Path Foundation",
  unit: "Sedan",
  driver: "Teddy Dimate",
  requestor: "",
  total: 1200,
  items_json: '[{"date":"11-Jun-26","destination":"Makati","passenger":"A. Cruz","amount":1200}]',
  created_at: "2026-06-14 08:00:00",
};

describe("toEditorInitial", () => {
  it("converts a stored document into editor values", () => {
    expect(toEditorInitial(row)).toEqual({
      date: "14 June 2026",
      billedTo: "Path Foundation",
      unit: "Sedan",
      driver: "Teddy Dimate",
      requestor: "",
      items: [{ date: "11-Jun-26", destination: "Makati", passenger: "A. Cruz", amount: 1200 }],
    });
  });

  it("returns null when stored line items are malformed", () => {
    expect(toEditorInitial({ ...row, items_json: "not-json" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails for the missing module**

Run: `npm run test -- src/lib/document-editor-data.test.ts`

Expected: FAIL with a module-not-found error for `./document-editor-data`.

- [ ] **Step 3: Implement the conversion module and database APIs**

Create `src/lib/document-editor-data.ts`:

```ts
import type { DocRow, Item } from "./db";

export interface EditorInitial {
  date?: string;
  billedTo?: string;
  unit?: string;
  driver?: string;
  requestor?: string;
  items?: Item[];
}

function parseItems(itemsJson: string): Item[] | null {
  try {
    const items: unknown = JSON.parse(itemsJson);
    return Array.isArray(items) ? (items as Item[]) : null;
  } catch {
    return null;
  }
}

export function toEditorInitial(doc: DocRow): EditorInitial | null {
  const items = parseItems(doc.items_json);
  if (!items) return null;

  return {
    date: doc.doc_date,
    billedTo: doc.billed_to,
    unit: doc.unit,
    driver: doc.driver,
    requestor: doc.requestor,
    items,
  };
}
```

Add these functions to `src/lib/db.ts` after `saveDoc`:

```ts
export async function getDoc(id: number): Promise<DocRow | undefined> {
  const db = await getDb();
  const res = db.exec("SELECT * FROM docs WHERE id = ? LIMIT 1", [id]);
  if (!res.length) return undefined;
  const [values] = res[0].values;
  const doc: Record<string, unknown> = {};
  res[0].columns.forEach((column, index) => (doc[column] = values[index]));
  return doc as unknown as DocRow;
}

export async function updateDoc(
  id: number,
  d: Omit<DocRow, "id" | "created_at">,
): Promise<void> {
  const db = await getDb();
  db.run(
    `UPDATE docs
     SET doc_type = ?, doc_date = ?, billed_to = ?, unit = ?, driver = ?, requestor = ?, total = ?, items_json = ?
     WHERE id = ?`,
    [d.doc_type, d.doc_date, d.billed_to, d.unit, d.driver, d.requestor, d.total, d.items_json, id],
  );
  await persist();
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test -- src/lib/document-editor-data.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 5: Commit the data boundary**

```powershell
git add src/lib/db.ts src/lib/document-editor-data.ts src/lib/document-editor-data.test.ts
git commit -m "feat: support loading and updating documents"
```

### Task 3: Make the shared editor update existing records

**Files:**
- Modify: `src/components/DocumentEditor.tsx`
- Create: `src/components/DocumentEditor.test.tsx`

**Interfaces:**
- Consumes: `EditorInitial` from `src/lib/document-editor-data.ts` and `updateDoc` from `src/lib/db.ts`.
- Produces: `DocumentEditor` with `documentId?: number`; it calls `saveDoc` when absent and `updateDoc(documentId, draft)` when present.

- [ ] **Step 1: Write the failing save-mode test**

Create `src/components/DocumentEditor.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ saveDoc: vi.fn(), updateDoc: vi.fn() }));

vi.mock("@/lib/db", () => ({ ...db }));
vi.mock("@/lib/pdf", () => ({ generatePdf: vi.fn() }));

import { DocumentEditor } from "./DocumentEditor";

describe("DocumentEditor", () => {
  beforeEach(() => {
    db.saveDoc.mockReset().mockResolvedValue(8);
    db.updateDoc.mockReset().mockResolvedValue(undefined);
  });

  it("updates the current document instead of inserting another record", async () => {
    render(
      <DocumentEditor
        docType="billing"
        documentId={7}
        initial={{ date: "14 June 2026", billedTo: "Path Foundation", unit: "Sedan", driver: "Teddy Dimate", items: [] }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(db.updateDoc).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ doc_type: "billing", doc_date: "14 June 2026", billed_to: "Path Foundation" }),
      );
    });
    expect(db.saveDoc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails for the missing prop behavior**

Run: `npm run test -- src/components/DocumentEditor.test.tsx`

Expected: FAIL because `DocumentEditor` has no `documentId` prop and always calls `saveDoc`.

- [ ] **Step 3: Implement the two save paths**

Replace the local `EditorInitial` declaration with this type import and expand the database import:

```ts
import { saveDoc, updateDoc, type DocType, type Item } from "@/lib/db";
import type { EditorInitial } from "@/lib/document-editor-data";
```

Add `documentId?: number` to the `DocumentEditor` props. In `save`, build the existing draft object, then replace the insert call with:

```ts
if (documentId === undefined) {
  await saveDoc(draft);
} else {
  await updateDoc(documentId, draft);
}
onSaved?.();
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test -- src/components/DocumentEditor.test.tsx`

Expected: PASS with 1 test.

- [ ] **Step 5: Commit the editor persistence behavior**

```powershell
git add src/components/DocumentEditor.tsx src/components/DocumentEditor.test.tsx
git commit -m "feat: update existing documents from editor"
```

### Task 4: Add full-page editor routes and replace overlay navigation

**Files:**
- Create: `src/components/DocumentEditorPage.tsx`
- Create: `src/components/DocList.test.tsx`
- Modify: `src/components/DocList.tsx`
- Create: `src/routes/billing.new.tsx`
- Create: `src/routes/billing.$id.edit.tsx`
- Create: `src/routes/quotation.new.tsx`
- Create: `src/routes/quotation.$id.edit.tsx`

**Interfaces:**
- Consumes: `getDoc`, `toEditorInitial`, and `DocumentEditor` from Tasks 2-3.
- Produces: full-page create/edit screens and type-safe `navigate` calls to the four specified editor URLs.

- [ ] **Step 1: Write the failing list-navigation tests**

Create `src/components/DocList.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), listDocs: vi.fn(), deleteDoc: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mocks.navigate,
}));
vi.mock("@/lib/db", () => ({ ...mocks }));
vi.mock("@/lib/pdf", () => ({ generatePdf: vi.fn() }));

import { DocList } from "./DocList";

describe("DocList navigation", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.listDocs.mockResolvedValue([
      { id: 7, doc_type: "billing", doc_date: "14 June 2026", billed_to: "Path Foundation", unit: "Sedan", driver: "Teddy Dimate", requestor: "", total: 1200, items_json: "[]", created_at: "2026-06-14" },
    ]);
  });

  it("opens the billing create route", async () => {
    render(<DocList docType="billing" />);
    fireEvent.click(await screen.findByRole("button", { name: "Create Billing" }));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/billing/new" });
  });

  it("opens the selected billing edit route", async () => {
    render(<DocList docType="billing" />);
    fireEvent.click(await screen.findByText("14 June 2026"));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/billing/$id/edit", params: { id: "7" } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails while the overlay remains**

Run: `npm run test -- src/components/DocList.test.tsx`

Expected: FAIL because `DocList` does not call `useNavigate`.

- [ ] **Step 3: Implement the full-page editor shell**

The sketch immediately below is superseded by the complete file in Step 3a; do not implement the sketch itself.

```tsx
const listRoute = docType === "billing" ? "/billing" : "/quotation";
const [status, setStatus] = useState<"loading" | "ready" | "unavailable">(
  documentId === undefined ? "ready" : "loading",
);
const [initial, setInitial] = useState<EditorInitial | undefined>();

useEffect(() => {
  if (documentId === undefined) return;
  let active = true;
  getDoc(documentId).then((doc) => {
    const editorInitial = doc ? toEditorInitial(doc) : null;
    if (!active) return;
    if (!editorInitial) setStatus("unavailable");
    else {
      setInitial(editorInitial);
      setStatus("ready");
    }
  }).catch(() => active && setStatus("unavailable"));
  return () => { active = false; };
}, [documentId]);
```

Render this state inside `AppLayout`:

```tsx
<div className="mx-auto w-full max-w-6xl space-y-6">
  <div className="flex items-center justify-between border-b pb-4">
    <div>
      <p className="text-sm text-muted-foreground">{documentId === undefined ? "New document" : "Update saved document"}</p>
      <h2 className="text-xl font-semibold">{documentId === undefined ? `Create ${label}` : `Edit ${label}`}</h2>
    </div>
    <button onClick={() => navigate({ to: listRoute })} className="btn-secondary">Cancel</button>
  </div>
  {status === "loading" && <p className="text-sm text-muted-foreground">Loading document…</p>}
  {status === "unavailable" && (
    <div className="rounded-md border bg-card p-6">
      <h2 className="font-semibold">This document is unavailable</h2>
      <p className="mt-1 text-sm text-muted-foreground">It may have been deleted or contains invalid line items.</p>
      <button onClick={() => navigate({ to: listRoute })} className="btn-primary mt-4">Back to {label}s</button>
    </div>
  )}
  {status === "ready" && <DocumentEditor docType={docType} documentId={documentId} initial={initial} onSaved={() => navigate({ to: listRoute })} />}
</div>
```

Use `AppLayout`'s title `Create Billing`, `Edit Billing`, `Create Quotation`, or `Edit Quotation`, and derive `label` from `docType`.

- [ ] **Step 3a: Create the complete full-page editor shell**

Create `src/components/DocumentEditorPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { DocumentEditor } from "@/components/DocumentEditor";
import { getDoc, type DocType } from "@/lib/db";
import { toEditorInitial, type EditorInitial } from "@/lib/document-editor-data";

type EditorStatus = "loading" | "ready" | "unavailable";

export function DocumentEditorPage({
  docType,
  documentId,
}: {
  docType: DocType;
  documentId?: number;
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<EditorStatus>(
    documentId === undefined ? "ready" : "loading",
  );
  const [initial, setInitial] = useState<EditorInitial | undefined>();
  const label = docType === "billing" ? "Billing" : "Quotation";
  const title = `${documentId === undefined ? "Create" : "Edit"} ${label}`;

  const returnToList = () => {
    if (docType === "billing") navigate({ to: "/billing" });
    else navigate({ to: "/quotation" });
  };

  useEffect(() => {
    if (documentId === undefined) return;

    let active = true;
    getDoc(documentId)
      .then((doc) => {
        const editorInitial = doc ? toEditorInitial(doc) : null;
        if (!active) return;
        if (!editorInitial) setStatus("unavailable");
        else {
          setInitial(editorInitial);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) setStatus("unavailable");
      });

    return () => {
      active = false;
    };
  }, [documentId]);

  return (
    <AppLayout title={title}>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {documentId === undefined ? "New document" : "Update saved document"}
            </p>
            <h2 className="text-xl font-semibold">{title}</h2>
          </div>
          <button onClick={returnToList} className="btn-secondary">
            Cancel
          </button>
        </div>

        {status === "loading" && (
          <p className="text-sm text-muted-foreground">Loading document...</p>
        )}

        {status === "unavailable" && (
          <div className="rounded-md border bg-card p-6">
            <h2 className="font-semibold">This document is unavailable</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              It may have been deleted or contains invalid line items.
            </p>
            <button onClick={returnToList} className="btn-primary mt-4">
              Back to {label}s
            </button>
          </div>
        )}

        {status === "ready" && (
          <DocumentEditor
            docType={docType}
            documentId={documentId}
            initial={initial}
            onSaved={returnToList}
          />
        )}
      </div>
    </AppLayout>
  );
}
```

- [ ] **Step 4: Replace dialog state with navigation in `DocList`**

Remove `open`, `initial`, `X`, `DocumentEditor`, and all fixed-overlay JSX. Add `const navigate = useNavigate();`. Implement the create handler and row click as:

```ts
const openCreate = () => {
  if (docType === "billing") navigate({ to: "/billing/new" });
  else navigate({ to: "/quotation/new" });
};

const openEdit = (id: number) => {
  if (docType === "billing") navigate({ to: "/billing/$id/edit", params: { id: String(id) } });
  else navigate({ to: "/quotation/$id/edit", params: { id: String(id) } });
};
```

Change the table row handler to `onClick={() => openEdit(d.id)}`. Keep preview, download, deletion, and their `stopPropagation` handler unchanged.

- [ ] **Step 5: Define all four file-based routes**

Use these route components; only the document type and edit parameter vary:

```tsx
// src/routes/billing.new.tsx
import { createFileRoute } from "@tanstack/react-router";
import { DocumentEditorPage } from "@/components/DocumentEditorPage";

export const Route = createFileRoute("/billing/new")({
  component: () => <DocumentEditorPage docType="billing" />,
});

// src/routes/billing.$id.edit.tsx
import { createFileRoute } from "@tanstack/react-router";
import { DocumentEditorPage } from "@/components/DocumentEditorPage";

export const Route = createFileRoute("/billing/$id/edit")({
  component: BillingEditPage,
});

function BillingEditPage() {
  const { id } = Route.useParams();
  return <DocumentEditorPage docType="billing" documentId={Number(id)} />;
}
```

Create these exact quotation route components:

```tsx
// src/routes/quotation.new.tsx
import { createFileRoute } from "@tanstack/react-router";
import { DocumentEditorPage } from "@/components/DocumentEditorPage";

export const Route = createFileRoute("/quotation/new")({
  component: () => <DocumentEditorPage docType="quotation" />,
});

// src/routes/quotation.$id.edit.tsx
import { createFileRoute } from "@tanstack/react-router";
import { DocumentEditorPage } from "@/components/DocumentEditorPage";

export const Route = createFileRoute("/quotation/$id/edit")({
  component: QuotationEditPage,
});

function QuotationEditPage() {
  const { id } = Route.useParams();
  return <DocumentEditorPage docType="quotation" documentId={Number(id)} />;
}
```

- [ ] **Step 6: Regenerate route types with a production build**

Run: `npm run build`

Expected: PASS and regenerate `src/routeTree.gen.ts` with `/billing/new`, `/billing/$id/edit`, `/quotation/new`, and `/quotation/$id/edit`.

- [ ] **Step 7: Run the focused navigation test to verify it passes**

Run: `npm run test -- src/components/DocList.test.tsx`

Expected: PASS with 2 tests, including navigation to `/billing/new` and `/billing/$id/edit` with ID `7`.

- [ ] **Step 8: Commit the route migration**

```powershell
git add src/components/DocumentEditorPage.tsx src/components/DocList.tsx src/components/DocList.test.tsx src/routes/billing.new.tsx src/routes/billing.$id.edit.tsx src/routes/quotation.new.tsx src/routes/quotation.$id.edit.tsx src/routeTree.gen.ts
git commit -m "feat: use full-page document editors"
```

### Task 5: Run integrated verification and document the result

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes all prior tasks.
- Produces a regenerated route tree and evidence that test, lint, and production build checks succeed.

- [ ] **Step 1: Run all automated tests**

Run: `npm run test`

Expected: PASS with the document conversion, existing-document save, and list navigation tests.

- [ ] **Step 2: Run static checks and regenerate the route tree**

Run: `npm run lint`

Expected: exit code 0 with no lint errors.

Run: `npm run build`

Expected: exit code 0. Confirm the generated `src/routeTree.gen.ts` includes all four editor paths.

- [ ] **Step 3: Document the test command**

Add `npm run test` as the first command in the `README.md` **Quality checks** block:

```sh
npm run test
npm run lint
npm run build
```

- [ ] **Step 4: Manually verify the user workflow in the browser**

Run: `npm run dev`

Verify each item before stopping the server:

1. Create and save a billing; it returns to `/billing` and appears once in the list.
2. Reopen that billing, edit its billed-to value, save, and confirm the list still has one record with the updated value.
3. Open a quotation create screen, click Cancel, and confirm no record is created.
4. Navigate directly to a nonexistent edit URL and confirm the recovery message has a working Back-to-list button.
5. Click around the form surface on each editor page and confirm no interaction can dismiss it.

- [ ] **Step 5: Commit generated and documentation changes**

```powershell
git add README.md src/routeTree.gen.ts
git commit -m "docs: document editor test command"
```
