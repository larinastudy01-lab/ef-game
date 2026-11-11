import { createBehavioralStore, behavioralResult } from "./behavioralStore.testSupport";
import { repairStoredBehavioralHierarchy } from "./behavioralSync";
import { researchTaskCodeCompatibility } from "../analytics/trials/constants";

const user = { id: "owner-a" };
const id = "p0-acceptance-repair-safety";
let store, client;
const execution = () => ({ environment: "isolated", projectRef: "local", targetOrigin: "http://127.0.0.1:54321",
  confirmation: "APPLY_SINGLE_SYNTHETIC_REPAIR", resultId: id, ownerId: user.id });
const inspect = () => repairStoredBehavioralHierarchy(client, id, user);
const apply = (approvedPlan, extra = {}) => repairStoredBehavioralHierarchy(client, id, user,
  { dryRun: false, execution: execution(), approvedPlan, ...extra });
beforeEach(() => {
  store = createBehavioralStore();
  client = { ...store.client, supabaseUrl: "http://127.0.0.1:54321" };
  const result = behavioralResult(); result.resultId = id;
  store.tables.game_results.push({ id, patient_id: "child-1", guardian_id: user.id, game_id: "LB", total_trials: 20, payload: result });
});

test("historical repair defaults to read-only and exposes a frozen source/identity plan", async () => {
  const plan = await inspect();
  expect(plan).toMatchObject({ dryRun: true, expectedTrialCount: 20, existingTrialCount: 0 });
  expect(plan.proposedBehavioralIds.trialIds).toHaveLength(20);
  expect(store.writes).toHaveLength(0);
});
test("dryRun false without environment and per-result authorization never queries or writes", async () => {
  await expect(repairStoredBehavioralHierarchy(client, id, user, { dryRun: false })).rejects.toThrow("authorization");
  expect(client.from).not.toHaveBeenCalled(); expect(store.writes).toHaveLength(0);
});
test("known production target is blocked even with every confirmation", async () => {
  client.supabaseUrl = "https://krgvfzjwqijjdwphsyto.supabase.co";
  await expect(apply({}, { execution: { ...execution(), projectRef: "krgvfzjwqijjdwphsyto", targetOrigin: client.supabaseUrl } })).rejects.toThrow("production");
  expect(client.from).not.toHaveBeenCalled();
});
test.each([null, 0, "false"])("ambiguous dryRun %j never implies permission to write", async (dryRun) => {
  await expect(repairStoredBehavioralHierarchy(client, id, user, { dryRun })).rejects.toThrow("boolean");
  expect(store.writes).toHaveLength(0);
});
test("unconfirmed or mismatched client target cannot write", async () => {
  await expect(apply({}, { execution: { ...execution(), projectRef: "other" } })).rejects.toThrow("target differs");
  delete client.supabaseUrl;
  await expect(apply({})).rejects.toThrow("cannot be verified");
  expect(store.writes).toHaveLength(0);
});
test("ordinary historical IDs cannot be applied in P0-B even on an isolated client", async () => {
  await expect(repairStoredBehavioralHierarchy(client, "real-legacy-id", user, { dryRun: false,
    execution: { ...execution(), resultId: "real-legacy-id" } })).rejects.toThrow("tagged synthetic");
});
test("missing and stale reviewed plans stop before the first mutation", async () => {
  await expect(apply(null)).rejects.toThrow("reviewed unchanged");
  const plan = await inspect(); store.tables.game_results[0].payload.trials[0].clickedKey = "later-answer";
  await expect(apply(plan)).rejects.toThrow("reviewed unchanged");
  expect(store.writes).toHaveLength(0);
});
test("a frozen plan supplies missing technical IDs, survives retries and leaves main history/status unchanged", async () => {
  delete store.tables.game_results[0].payload.behavioral;
  const original = JSON.stringify(store.tables.game_results);
  const plan = await inspect();
  store.once("behavioral_trial_derivations", "upsert", () => ({ data: null, error: new Error("lost network") }));
  await expect(apply(plan)).rejects.toThrow("lost network");
  const ids = store.tables.behavioral_trials.map((r) => r.id);
  const saved = await apply(JSON.parse(JSON.stringify(plan)));
  await apply(plan);
  expect(saved).toMatchObject({ verifiedTrialCount: 20, mainSyncStateUpdated: false });
  expect(store.tables.behavioral_trials.map((r) => r.id)).toEqual(ids);
  expect(ids).toEqual(plan.proposedBehavioralIds.trialIds);
  expect(JSON.stringify(store.tables.game_results)).toBe(original);
});
test("raw conflicts stop repair without overwriting acquired answers", async () => {
  const plan = await inspect(); await apply(plan);
  store.tables.behavioral_trials[0].raw_data.clickedKey = "conflict";
  const before = JSON.stringify(store.tables.behavioral_trials);
  await expect(apply(plan)).rejects.toThrow("raw content differs");
  expect(JSON.stringify(store.tables.behavioral_trials)).toBe(before);
});
test("declared source count and current processing version are both checked", async () => {
  const plan = await inspect();
  await expect(apply({ ...plan, processingVersion: "old" })).rejects.toThrow("processing version");
  store.tables.game_results[0].total_trials = 21;
  await expect(inspect()).rejects.toThrow("missing trials"); expect(store.writes).toHaveLength(0);
});
test("a source changed during a repair is never acknowledged as verified", async () => {
  const plan = await inspect();
  store.once("behavioral_trial_derivations", "upsert", () => { store.tables.game_results[0].payload.changedElsewhere = true; });
  await expect(apply(plan)).rejects.toThrow("source changed during repair");
  expect(store.tables.game_results[0].payload.changedElsewhere).toBe(true);
});
test("missing historical start time stays null instead of being fabricated from finish time", async () => {
  delete store.tables.game_results[0].payload.session.startedAt;
  const plan = await inspect(); await apply(plan);
  expect(plan.timestampProvenance.startedAt).toBe("not_recorded_preserved_null");
  expect(store.tables.behavioral_sessions[0].started_at).toBeNull();
  expect(store.tables.behavioral_task_sessions[0].started_at).toBeNull();
});
test.each(["ART", "SSG", "DPT", "UNKNOWN"])("%s is preserved for reading, never guessed to be ARI", async (code) => {
  expect(researchTaskCodeCompatibility(code)).toMatchObject({ taskCode: code, writable: false });
  store.tables.game_results[0].payload.game.gameId = code;
  await expect(inspect()).rejects.toThrow("legacy task"); expect(store.writes).toHaveLength(0);
});
test.each(["CBT", "PM", "SRT", "ARI", "LB", "DCCS"])("current code %s has one explicit storage mapping", (code) => {
  expect(researchTaskCodeCompatibility(code)).toMatchObject({ taskCode: code, writable: true, policy: "current_task" });
});
