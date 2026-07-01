import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { removeUnexpectedDocumentChildren } from "./utils/document-hydration";

// React Router hydrates the entire document. Browser extensions and test tools
// can inject invalid siblings beside <head> and <body> before the client entry
// runs, which makes React abandon hydration and replace the document. Removing
// only those impossible document-level siblings keeps the server document,
// stylesheets, and bootstrap scripts intact. In ordinary browsers this is a
// no-op because <html> contains only <head> and <body>.
removeUnexpectedDocumentChildren(document);

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
