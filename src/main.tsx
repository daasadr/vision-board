import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./app/Root";
import "./design/global.css";
import { initSettings } from "./lib/settings";

// Theme and language are applied before the first render, so the window never flashes the
// wrong theme or language.
void initSettings().then(() =>
  createRoot(document.getElementById("root") as HTMLElement).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  ),
);
