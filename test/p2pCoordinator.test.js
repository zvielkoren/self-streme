import test from "node:test";
import assert from "node:assert/strict";
import P2PCoordinator from "../src/services/p2pCoordinator.js";

test("P2PCoordinator normalizes endpoint fields safely", () => {
  const coordinator = new P2PCoordinator();

  assert.deepEqual(coordinator.normalizeEndpoint({ ip: "1.2.3.4", port: "6881" }), {
    address: "1.2.3.4",
    port: 6881,
  });

  assert.deepEqual(coordinator.normalizeEndpoint(null), {
    address: "unknown",
    port: null,
  });
});

test("P2PCoordinator rejects missing peer endpoint", () => {
  const coordinator = new P2PCoordinator();

  assert.throws(
    () => coordinator.getPeerEndpoint({ id: "peer-1", publicEndpoint: null }),
    /no usable public endpoint/i,
  );
});
