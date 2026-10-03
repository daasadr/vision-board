import "i18next";
import type { resources } from ".";

// Makes t("...") keys type-checked against the Czech locale (the source language).
declare module "i18next" {
  interface CustomTypeOptions {
    resources: (typeof resources)["cs"];
    returnNull: false;
  }
}
