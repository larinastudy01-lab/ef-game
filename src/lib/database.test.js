import {
  saveGameResultToCloud, getResultsByPatientFromCloud,
  getResearchFeatureInputsFromCloud, repairBehavioralHierarchyFromResultId,
} from "./database";
import { supabase } from "./supabaseClient";
import { createBehavioralStore, behavioralResult } from "./behavioralStore.testSupport";
import { buildBehavioralHierarchy } from "../analytics/trials/buildBehavioralHierarchy";
import { behavioralDerivationRows } from "./behavioralSync";
import { TRIAL_PROCESSING_VERSION } from "../analytics/trials/constants";
import { startResultSync, queueGameResult, flushResultOutbox, readResultOutbox } from "../utils/resultSync";

jest.mock("./supabaseClient", () => ({
  supabase: { supabaseUrl: "http://127.0.0.1:54321", auth: { getUser: jest.fn(), onAuthStateChange: jest.fn() }, from: jest.fn() },
}));
let store;
const networkError = () => ({ data: null, error: new Error("Network interrupted") });
beforeEach(() => {
  jest.clearAllMocks();
  store = createBehavioralStore();
  store.tables.profiles.push({ id: "owner-a", role: "clinician" });
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-a" } } });
  supabase.from.mockImplementation(store.client.from);
});

test("an account change before upload never writes under the other account", async () => {
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-b" } } });
  expect(await saveGameResultToCloud(behavioralResult(), { expectedOwnerId: "owner-a" })).toBeNull();
  expect(supabase.from).not.toHaveBeenCalled();
});

test.each(["LB", "PM"])("complete %s upload verifies every raw/derived trial and idempotently reads back", async (task) => {
  const record = behavioralResult(task);
  const before = JSON.stringify(record);
  const first = await saveGameResultToCloud(record, { expectedOwnerId: "owner-a" });
  const second = await saveGameResultToCloud(JSON.parse(before), { expectedOwnerId: "owner-a" });
  expect(first.syncState).toMatchObject({ gameResult: "saved", researchHierarchy: "verified", expectedTrialCount: 20, verifiedTrialCount: 20 });
  expect(second.payload.behavioral).toEqual(first.payload.behavioral);
  expect(store.tables.behavioral_sessions).toHaveLength(1);
  expect(store.tables.behavioral_task_sessions).toHaveLength(1);
  expect(store.tables.behavioral_trials).toHaveLength(20);
  expect(new Set(store.tables.behavioral_trials.map((row) => row.source_trial_key)).size).toBe(20);
  expect(store.tables.behavioral_trial_derivations.filter((row) => row.is_current)).toHaveLength(20);
  expect(JSON.stringify(record)).toBe(before);
  const [input] = await getResearchFeatureInputsFromCloud();
  expect(input.rawTrials.map((row) => row.raw_data)).toEqual(record.trials);
  expect(input.trials.map((row) => row.trial_id)).toEqual(first.payload.behavioral.trialIds);
  expect(input.trials.every((row) => row.valid_trial)).toBe(true);
  const [parentResult] = await getResultsByPatientFromCloud("child-1");
  expect(parentResult.payload.rawResult.trialLogs).toEqual(record.rawResult.trialLogs);
});

test.each([
  ["game_results", "insert", "pending"],
  ["research_participants", "upsert", "saved"],
  ["behavioral_sessions", "upsert", "saved"],
  ["behavioral_task_sessions", "upsert", "saved"],
  ["behavioral_trials", "upsert", "saved"],
  ["behavioral_trial_derivations", "upsert", "saved"],
  ["behavioral_trial_derivations", "update", "saved"],
  ["game_results", "update", "saved"],
])("%s %s failure never acknowledges complete and a retry fills all data", async (table, operation, mainState) => {
  store.once(table, operation, networkError);
  const record = behavioralResult();
  await expect(saveGameResultToCloud(record)).rejects.toMatchObject({
    syncState: { gameResult: mainState, researchHierarchy: "pending" },
  });
  expect(store.tables.game_results[0]?.payload.syncStatus).not.toBe("synced");
  const completed = await saveGameResultToCloud(record);
  expect(completed.syncState.researchHierarchy).toBe("verified");
  expect(store.tables.behavioral_trials).toHaveLength(20);
});

test("existing session survives a later main-result failure", async () => {
  await saveGameResultToCloud(behavioralResult());
  const before = JSON.stringify(store.tables.behavioral_sessions);
  store.once("game_results", "update", networkError);
  await expect(saveGameResultToCloud(behavioralResult())).rejects.toThrow("Network interrupted");
  expect(JSON.stringify(store.tables.behavioral_sessions)).toBe(before);
  expect((await saveGameResultToCloud(behavioralResult())).syncState.researchHierarchy).toBe("verified");
});

test("silently incomplete raw insert fails count verification; partial rows are filled on retry", async () => {
  store.once("behavioral_trials", "upsert", (query) => { query.values = query.values.slice(0, 7); });
  await expect(saveGameResultToCloud(behavioralResult())).rejects.toThrow("raw trial count/IDs");
  expect(store.tables.behavioral_trials).toHaveLength(7);
  expect((await getResearchFeatureInputsFromCloud())[0].trials).toHaveLength(20);
  await saveGameResultToCloud(behavioralResult());
  expect(store.tables.behavioral_trials).toHaveLength(20);
});

test("missing derivations are read from the complete main payload even when a session already exists", async () => {
  store.once("behavioral_trial_derivations", "upsert", networkError);
  await expect(saveGameResultToCloud(behavioralResult())).rejects.toThrow();
  const before = store.writes.length;
  const [input] = await getResearchFeatureInputsFromCloud();
  expect(input.trials).toHaveLength(20);
  expect(input.rawTrials.map((row) => row.raw_data)).toEqual(behavioralResult().trials);
  expect(store.writes).toHaveLength(before);
  expect(input.researchReadStatus).toBe("reconstructed_from_main_payload");
});

test("content mismatches are retained and rejected rather than overwritten or falsely acknowledged", async () => {
  await saveGameResultToCloud(behavioralResult());
  store.tables.behavioral_trials[0].raw_data.clickedKey = "conflicting-existing-data";
  const before = JSON.stringify(store.tables.behavioral_trials);
  await expect(saveGameResultToCloud(behavioralResult())).rejects.toThrow("raw content differs");
  expect(JSON.stringify(store.tables.behavioral_trials)).toBe(before);
});

test("a changed source answer cannot overwrite a durable main result", async () => {
  await saveGameResultToCloud(behavioralResult());
  const changed = behavioralResult();
  changed.trials[0].clickedKey = "changed";
  const before = JSON.stringify(store.tables.game_results);
  await expect(saveGameResultToCloud(changed)).rejects.toThrow("refusing to overwrite");
  expect(JSON.stringify(store.tables.game_results)).toBe(before);
});

test("raw history aliases cannot be changed while keeping normalized trials unchanged", async () => {
  await saveGameResultToCloud(behavioralResult());
  const changed = behavioralResult();
  changed.rawResult.trialLogs[0].clickedKey = "changed-raw-alias";
  await expect(saveGameResultToCloud(changed)).rejects.toThrow("stored raw history differs");
});

test("compare-and-set refuses to overwrite a concurrent main-result update", async () => {
  await saveGameResultToCloud(behavioralResult());
  store.once("game_results", "update", () => {
    store.tables.game_results[0].payload.concurrentMarker = "newer-checkpoint";
    store.tables.game_results[0].payload.syncState.revision = "newer-revision";
  });
  await expect(saveGameResultToCloud(behavioralResult())).rejects.toThrow("Expected one row");
  expect(store.tables.game_results[0].payload.concurrentMarker).toBe("newer-checkpoint");
});

test("legacy revision adoption cannot overwrite a concurrent first adoption", async () => {
  await saveGameResultToCloud(behavioralResult());
  delete store.tables.game_results[0].payload.syncState.revision;
  store.once("game_results", "update", () => {
    store.tables.game_results[0].payload.syncState.revision = "concurrent-adoption";
  });
  await expect(saveGameResultToCloud(behavioralResult())).rejects.toThrow("Expected one row");
  expect(store.tables.game_results[0].payload.syncState.revision).toBe("concurrent-adoption");
});

test("lost initial-insert acknowledgement retries without duplicate main or trial rows", async () => {
  store.once("game_results", "insert", (query) => {
    store.tables.game_results.push(JSON.parse(JSON.stringify(query.values[0])));
    return networkError();
  });
  await expect(saveGameResultToCloud(behavioralResult())).rejects.toThrow("Network interrupted");
  await saveGameResultToCloud(behavioralResult());
  expect(store.tables.game_results).toHaveLength(1);
  expect(store.tables.behavioral_trials).toHaveLength(20);
});

test("legacy invalid timestamps remain in immutable raw data and use nullable occurred_at", async () => {
  const result = behavioralResult("PM", 1);
  result.trials[0].timestamp = "legacy-invalid-date";
  await saveGameResultToCloud(result);
  expect(store.tables.behavioral_trials[0].occurred_at).toBeNull();
  expect(store.tables.behavioral_trials[0].raw_data.timestamp).toBe("legacy-invalid-date");
});

test("verification reads paginate beyond a server row limit", async () => {
  store.maxRows = 200;
  const result = behavioralResult("PM", 405);
  const completed = await saveGameResultToCloud(result);
  expect(completed.syncState.verifiedTrialCount).toBe(405);
  expect(store.tables.behavioral_trials).toHaveLength(405);
});

test("zero-trial interrupted attempts still verify session, task and main result", async () => {
  const result = behavioralResult("PM", 0);
  result.session.status = "interrupted";
  const completed = await saveGameResultToCloud(result);
  expect(completed.syncState).toMatchObject({ expectedTrialCount: 0, verifiedTrialCount: 0, researchHierarchy: "verified" });
  expect(store.tables.behavioral_sessions[0].session_status).toBe("interrupted");
});

async function seedLegacyPartial() {
  store.once("behavioral_trial_derivations", "upsert", networkError);
  await expect(saveGameResultToCloud(behavioralResult())).rejects.toThrow();
  store.tables.behavioral_trials.splice(10);
  store.tables.behavioral_trials.forEach((row, index) => {
    row.source_trial_key = String(index);
    row.id = "legacy-" + index;
    row.raw_schema_version = "1.0.0";
  });
  const old = buildBehavioralHierarchy(behavioralResult());
  old.processingVersion = "trial-normalizer-1.0.0";
  old.trials = old.trials.slice(0, 10).map((trial, index) => ({ ...trial, trialId: "legacy-" + index }));
  store.tables.behavioral_trial_derivations = behavioralDerivationRows(old, store.tables.research_participants[0].id)
    .map((row, index) => ({ id: "old-derived-" + index, ...row }));
  store.tables.game_results[0].id = "p0-acceptance-legacy";
  store.tables.behavioral_sessions[0].source_result_id = "p0-acceptance-legacy";
}

const repairExecution = (ownerId = "owner-a") => ({ environment: "isolated", confirmation: "APPLY_SINGLE_SYNTHETIC_REPAIR",
  resultId: "p0-acceptance-legacy", ownerId, projectRef: "local", targetOrigin: "http://127.0.0.1:54321" });

test("dry-run then repeatable historical repair preserves legacy keys, IDs, raw history and old versions", async () => {
  await seedLegacyPartial();
  const originalRaw = JSON.parse(JSON.stringify(store.tables.behavioral_trials));
  const originalMain = JSON.stringify(store.tables.game_results);
  const writes = store.writes.length;
  const plan = await repairBehavioralHierarchyFromResultId("p0-acceptance-legacy");
  expect(plan).toMatchObject({ dryRun: true, expectedTrialCount: 20, existingTrialCount: 10 });
  expect(plan.missingTrialIds).toHaveLength(10);
  expect(plan.previousCurrentVersions.every((row) => row.isCurrent)).toBe(true);
  expect(store.writes).toHaveLength(writes);
  const repaired = await repairBehavioralHierarchyFromResultId("p0-acceptance-legacy", { dryRun: false, execution: repairExecution(), approvedPlan: plan });
  expect(repaired.verifiedTrialCount).toBe(20);
  await repairBehavioralHierarchyFromResultId("p0-acceptance-legacy", { dryRun: false, execution: repairExecution(), approvedPlan: plan });
  expect(store.tables.behavioral_trials).toHaveLength(20);
  expect(store.tables.behavioral_trials.slice(0, 10)).toEqual(originalRaw);
  expect(store.tables.behavioral_trial_derivations.filter((row) => row.processing_version === "trial-normalizer-1.0.0")).toHaveLength(10);
  expect(store.tables.behavioral_trial_derivations.filter((row) => row.is_current && row.processing_version === TRIAL_PROCESSING_VERSION)).toHaveLength(20);
  expect(JSON.stringify(store.tables.game_results)).toBe(originalMain);
  const [input] = await getResearchFeatureInputsFromCloud();
  expect(input.trials.slice(0, 10).map((trial) => trial.trial_id)).toEqual(originalRaw.map((row) => row.id));
  expect(input.rawTrials.map((row) => row.raw_data)).toEqual(behavioralResult().trials);
});

test("non-guardian cannot apply a repair, and missing original trials require manual recovery", async () => {
  await seedLegacyPartial();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "other-user" } } });
  const writes = store.writes.length;
  await expect(repairBehavioralHierarchyFromResultId("p0-acceptance-legacy", { dryRun: false, execution: repairExecution("other-user") })).rejects.toThrow("only the source guardian");
  expect(store.writes).toHaveLength(writes);
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-a" } } });
  store.tables.game_results[0].payload.trials = [];
  store.tables.game_results[0].payload.rawResult.trialLogs = [];
  await expect(repairBehavioralHierarchyFromResultId("p0-acceptance-legacy")).rejects.toThrow("missing trials");
});

test("real outbox integration survives partial sync and application restart, then verifies research readback", async () => {
  jest.useFakeTimers();
  localStorage.clear(); sessionStorage.clear();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  supabase.auth.onAuthStateChange.mockImplementation((callback) => {
    callback("INITIAL_SESSION", { user: { id: "owner-a" } });
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  let stop = startResultSync();
  try {
    await flushResultOutbox();
    store.once("behavioral_trial_derivations", "upsert", networkError);
    queueGameResult(behavioralResult(), { ownerId: "owner-a" });
    await flushResultOutbox();
    expect(readResultOutbox()).toHaveLength(1);
    expect(readResultOutbox()[0].result.syncState).toMatchObject({ gameResult: "saved", researchHierarchy: "pending" });
    expect(readResultOutbox()[0].result.trials).toHaveLength(20);
    stop();
    stop = startResultSync();
    await flushResultOutbox();
    expect(readResultOutbox()).toHaveLength(0);
    expect(store.tables.game_results[0].payload.syncStatus).toBe("synced");
    expect((await getResearchFeatureInputsFromCloud())[0].rawTrials.map((row) => row.raw_data)).toEqual(behavioralResult().trials);
  } finally {
    stop(); jest.clearAllTimers(); jest.useRealTimers();
  }
});
