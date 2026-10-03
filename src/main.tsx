import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./app/Root";
import "./design/global.css";
import { followTheme } from "./design/theme";
import { initI18n, resolveLanguage } from "./i18n";

// Applied before the first render so the window never flashes the wrong theme or language.
followTheme("system");
void initI18n(resolveLanguage("system"));

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
