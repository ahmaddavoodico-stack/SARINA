import { assertEquals } from "jsr:@std/assert";
import { getRegisteredAgent } from "./task-orchestrator.ts";
import {
  getSpecialistSelectionProfile,
  SPECIALIST_SELECTION_PROFILES,
} from "./agent-selection.ts";

const EXPECTED_SPECIALISTS = [
  "soil_water_specialist",
  "irrigation_specialist",
  "plant_nutrition_specialist",
  "plant_health_specialist",
  "climate_specialist",
  "agricultural_knowledge_specialist",
  "market_intelligence_specialist",
  "trade_export_specialist",
  "finance_economics_specialist",
  "logistics_supply_chain_specialist",
] as const;

Deno.test("selection catalog covers every registered specialist exactly once", () => {
  const ids = SPECIALIST_SELECTION_PROFILES.map((profile) => profile.agentId);
  assertEquals(new Set(ids).size, ids.length);
  assertEquals([...ids].sort(), [...EXPECTED_SPECIALISTS].sort());
});

Deno.test("selection profiles do not enable providers or specialists", () => {
  for (const profile of SPECIALIST_SELECTION_PROFILES) {
    assertEquals(profile.providerDispatchEnabled, false);
    const registered = getRegisteredAgent(profile.agentId);
    assertEquals(registered?.lifecycleState, "registered");
    assertEquals(registered?.enabled, false);
    assertEquals(profile.acceptanceGates.length > 0, true);
    assertEquals(profile.hardBoundaries.length > 0, true);
  }
});

Deno.test("Manus remains a pending first pilot, not an accepted ready agent", () => {
  const profile = getSpecialistSelectionProfile("market_intelligence_specialist");
  assertEquals(profile?.disposition, "pilot_adapter_pending_acceptance");
  assertEquals(profile?.providerDispatchEnabled, false);
});

Deno.test("plant health remains deferred until field evidence is available", () => {
  const profile = getSpecialistSelectionProfile("plant_health_specialist");
  assertEquals(profile?.disposition, "defer_until_field_data");
  assertEquals(profile?.providerDispatchEnabled, false);
});
