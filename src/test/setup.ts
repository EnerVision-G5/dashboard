/**
 * Configuration commune aux tests : démonte le DOM entre deux cas pour qu'un
 * rendu ne fuite pas dans le test suivant.
 */

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
