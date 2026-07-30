import "@testing-library/jest-dom/vitest";

import { afterEach } from "vitest";

import { useConsoleStore } from "@/lib/store";

/**
 * The console store is a module-level singleton, so state leaks between tests
 * unless it is reset. Capture the initial state once, before any test mutates
 * it, and restore it after each.
 */
const INITIAL_STATE = useConsoleStore.getState();

afterEach(() => {
  useConsoleStore.setState(INITIAL_STATE, true);
});
