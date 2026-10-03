// The only module that talks to the Rust backend. Everything else imports from here,
// which keeps IPC typed in one place and lets E2E tests swap it for a mock.
import { commands } from "./bindings";

export const ipc = commands;
