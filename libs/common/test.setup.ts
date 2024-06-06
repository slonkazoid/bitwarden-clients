import { webcrypto } from "crypto";

import { addCustomMatchers } from "./spec/matchers/";

Object.defineProperty(window, "crypto", {
  value: webcrypto,
});

// Add custom matchers
addCustomMatchers();
