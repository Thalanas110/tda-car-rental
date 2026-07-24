# PDF brand typography

## Scope

Update the generated billing and quotation PDFs only. The page header brand name will use the bundled `public/Britannic Bold Regular.ttf` font. The footer brand name and contact details will use a bold, non-italic serif fallback because Goudy Type is not available to license or bundle.

## Implementation

Register Britannic Bold with jsPDF once per generated document from the public font asset, then select it only for the header `TDA CAR RENTAL SERVICES` text. Use jsPDF's built-in Times Bold font for all three footer lines. All other document layout, copy, fonts, and data remain unchanged.

## Verification

Add focused tests that assert the registered and selected header and footer font styles. Run the test suite and production build.
