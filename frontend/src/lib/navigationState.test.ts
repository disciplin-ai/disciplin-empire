import assert from "node:assert/strict";
import test from "node:test";
import { isDestinationActive } from "./navigationState";

const destinations = ["/sensei-vision", "/sensei", "/dashboard", "/fuel", "/profile"];

test("every major route selects exactly one destination", () => {
  for (const pathname of destinations) {
    const selected = destinations.filter((href) => isDestinationActive(pathname, href));
    assert.deepEqual(selected, [pathname]);
  }
});

test("Vision does not also select Sensei", () => {
  assert.equal(isDestinationActive("/sensei-vision", "/sensei-vision"), true);
  assert.equal(isDestinationActive("/sensei-vision", "/sensei"), false);
});

test("temporary Dashboard query state does not change destination selection", () => {
  assert.equal(isDestinationActive("/dashboard", "/dashboard"), true);
  assert.equal(isDestinationActive("/dashboard", "/sensei"), false);
});
