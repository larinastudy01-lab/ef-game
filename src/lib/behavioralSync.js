import { buildBehavioralHierarchy, createBehavioralId } from "../analytics/trials/buildBehavioralHierarchy";
import { researchTaskCodeCompatibility } from "../analytics/trials/constants";

const PAGE_SIZE = 200;
const stableJson = (value) => JSON.stringify(value, (_, item) => {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
  }
  return item;
});
export const sameBehavioralData = (left, right) => stableJson(left) === stableJson(right);
const fail = (message) => { throw new Error(`Behavioral integrity: ${message}`); };
const isoTimestamp = (value) => {
  if (value == null || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};
const checked = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

// Page every verification read; a server row limit must never become an ACK.
export async function readBehavioralRows(client, table, configure) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await checked(configure(client.from(table).select("*")).order("id").range(offset, offset + PAGE_SIZE - 1));
    if (!Array.isArray(page)) fail(`missing ${table} readback`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export function normalizedStoredResult(row) {
  let payload = row.payload;
  if (typeof payload === "string") {
    try { payload = JSON.parse(payload); } catch { fail("unreadable game result payload"); }
  }
  payload = payload && typeof payload === "object" ? payload : {};
  const raw = payload.rawResult || {};
  const candidates = [payload.trials, raw.trials, raw.trialLogs, raw.records, raw.logs, raw.history, raw.rounds];
  const trials = candidates.find((value) => Array.isArray(value) && value.length) || [];
  return {
    ...payload, resultId: row.id,
    child: { ...(payload.child || {}), childId: row.patient_id },
    game: { ...(payload.game || {}), gameId: payload.game?.gameId || row.game_id },
    session: { ...(payload.session || {}), mode: payload.session?.mode || row.mode,
      difficulty: payload.session?.difficulty || row.difficulty,
      startedAt: payload.session?.startedAt || row.started_at || row.finished_at,
      finishedAt: payload.session?.finishedAt || row.finished_at },
    trials,
  };
}

export async function prepareBehavioralHierarchy(client, result) {
  if (!result.resultId) fail("stable resultId is required");
  const storedSession = await checked(client.from("behavioral_sessions").select("*")
    .eq("source_result_id", result.resultId).maybeSingle());
  const storedTask = storedSession ? await checked(client.from("behavioral_task_sessions").select("*")
    .eq("session_id", storedSession.id).eq("task_order_index", 1).maybeSingle()) : null;
  // Existing natural-key associations win over generated IDs, including legacy
  // payloads without behavioral IDs. No immutable acquisition row is rewritten.
  const hierarchy = buildBehavioralHierarchy({ ...result, behavioral: {
    ...result.behavioral,
    ...(storedSession ? { sessionId: storedSession.id } : {}),
    ...(storedTask ? { taskSessionId: storedTask.id } : {}),
  } });
  return { hierarchy, storedSession, storedTask };
}

export function reconcileBehavioralTrials(hierarchy, storedRows = []) {
  const usedIds = new Set();
  const sourceKeys = new Set();
  const trials = hierarchy.trials.map((trial) => {
    if (sourceKeys.has(trial.sourceTrialKey)) fail(`duplicate source key ${trial.sourceTrialKey}`);
    sourceKeys.add(trial.sourceTrialKey);
    let stored = storedRows.find((row) => row.id === trial.trialId)
      || storedRows.find((row) => row.source_trial_key === trial.sourceTrialKey);
    if (stored && !sameBehavioralData(stored.raw_data, trial.rawData)) fail(`raw content differs for ${stored.id}`);
    if (!stored && trial.legacySourceTrialKey !== undefined) {
      stored = storedRows.find((row) => row.source_trial_key === trial.legacySourceTrialKey
        && sameBehavioralData(row.raw_data, trial.rawData));
    }
    if (stored) {
      if (usedIds.has(stored.id)) fail(`ambiguous legacy identity ${stored.id}`);
      usedIds.add(stored.id);
    }
    return { ...trial, trialId: stored?.id || trial.trialId,
      storedSourceTrialKey: stored?.source_trial_key || trial.sourceTrialKey };
  });
  if (storedRows.some((row) => !usedIds.has(row.id))) fail("stored trials are absent from the source result; manual review required");
  if (new Set(trials.map((trial) => trial.trialId)).size !== trials.length) fail("duplicate trial IDs");
  return { ...hierarchy, trials };
}

export function behavioralDerivationRows(hierarchy, participantId) {
  const task = hierarchy.taskSession;
  return hierarchy.trials.map((trial) => ({
    trial_id: trial.trialId, participant_id: participantId, task_name: task.taskName, task_code: task.taskCode,
    trial_index: trial.trialIndex, stimulus: trial.stimulus ?? null, condition: trial.condition ?? null,
    difficulty: trial.difficulty, expected_response: trial.expectedResponse ?? null,
    actual_response: trial.actualResponse ?? null, is_correct: trial.isCorrect,
    reaction_time_ms: trial.reactionTimeMs, error_type: trial.errorType ?? null,
    task_specific_metadata: { ...trial.taskSpecificMetadata,
      ...(task.taskCode === "LB" ? { canonicalSourceTrialKey: trial.sourceTrialKey } : {}) },
    valid_trial: trial.validTrial, exclusion_reasons: trial.exclusionReasons,
    processing_version: hierarchy.processingVersion, is_current: true,
  }));
}

const matchesFields = (stored, expected) => stored && Object.keys(expected)
  .every((key) => sameBehavioralData(stored[key], expected[key]));

export async function readBehavioralDerivations(client, trialIds) {
  const rows = [];
  for (let offset = 0; offset < trialIds.length; offset += PAGE_SIZE) {
    rows.push(...await readBehavioralRows(client, "behavioral_trial_derivations", (query) =>
      query.in("trial_id", trialIds.slice(offset, offset + PAGE_SIZE))));
  }
  return rows;
}

export async function persistVerifiedBehavioralHierarchy(client, prepared, patientId) {
  let { hierarchy } = prepared;
  const participant = await checked(client.from("research_participants")
    .upsert({ patient_id: patientId }, { onConflict: "patient_id" }).select("id").single());
  if (!participant?.id) fail("participant not acknowledged");
  const participantId = participant.id;
  if (prepared.storedSession && prepared.storedSession.participant_id !== participantId) fail("participant association differs");
  const session = hierarchy.session;
  const task = hierarchy.taskSession;
  const existingRows = await readBehavioralRows(client, "behavioral_trials", (query) => query.eq("task_session_id", task.taskSessionId));
  hierarchy = reconcileBehavioralTrials(hierarchy, existingRows);
  const sessionRow = {
    id: session.sessionId, participant_id: participantId, session_type: session.sessionType,
    assessment_or_training: session.assessmentOrTraining, started_at: session.startedAt, completed_at: session.completedAt,
    device_information: session.deviceInformation, task_order: session.taskOrder, session_status: session.sessionStatus,
    source_result_id: session.sourceResultId, schema_version: hierarchy.schemaVersion,
  };
  const taskRow = {
    id: task.taskSessionId, session_id: session.sessionId, task_code: task.taskCode, task_name: task.taskName,
    task_order_index: 1, difficulty: task.difficulty, started_at: task.startedAt, completed_at: task.completedAt,
    total_trials: task.totalTrials, correct_trials: task.correctTrials, incorrect_trials: task.incorrectTrials,
    mean_reaction_time_ms: task.meanReactionTime, completion_status: task.completionStatus,
    raw_task_data: task.rawData, raw_schema_version: hierarchy.schemaVersion,
  };
  await checked(client.from("behavioral_sessions").upsert(sessionRow, { onConflict: "id" }));
  await checked(client.from("behavioral_task_sessions").upsert(taskRow, { onConflict: "id" }));
  const missing = hierarchy.trials.filter((trial) => !existingRows.some((row) => row.id === trial.trialId));
  if (missing.length) {
    await checked(client.from("behavioral_trials").upsert(missing.map((trial) => ({
      id: trial.trialId, task_session_id: task.taskSessionId, source_trial_key: trial.sourceTrialKey,
      trial_index: trial.trialIndex, occurred_at: isoTimestamp(trial.occurredAt),
      raw_data: trial.rawData, raw_schema_version: hierarchy.schemaVersion,
    })), { onConflict: "id", ignoreDuplicates: true }));
  }
  const rawRows = await readBehavioralRows(client, "behavioral_trials", (query) => query.eq("task_session_id", task.taskSessionId));
  const verified = reconcileBehavioralTrials(hierarchy, rawRows);
  if (rawRows.length !== hierarchy.trials.length
    || verified.trials.some((trial, index) => trial.trialId !== hierarchy.trials[index].trialId)) fail("raw trial count/IDs not acknowledged");

  const derivedRows = behavioralDerivationRows(hierarchy, participantId);
  const trialIds = derivedRows.map((row) => row.trial_id);
  if (derivedRows.length) {
    // Stage the NEW processing version first. Old versions and all acquisition
    // data remain intact. A failed activation stays pending and is retryable;
    // readers fall back to the durable main payload during the activation gap.
    await checked(client.from("behavioral_trial_derivations")
      .upsert(derivedRows.map((row) => ({ ...row, is_current: false })), { onConflict: "trial_id,processing_version" }));
    const staged = await readBehavioralDerivations(client, trialIds);
    if (derivedRows.some((expected) => !matchesFields(staged.find((row) => row.trial_id === expected.trial_id
      && row.processing_version === expected.processing_version), { ...expected, is_current: false }))) fail("staged derivation differs");
    for (let offset = 0; offset < trialIds.length; offset += PAGE_SIZE) {
      const ids = trialIds.slice(offset, offset + PAGE_SIZE);
      await checked(client.from("behavioral_trial_derivations").update({ is_current: false })
        .in("trial_id", ids).neq("processing_version", hierarchy.processingVersion).eq("is_current", true));
      await checked(client.from("behavioral_trial_derivations").update({ is_current: true })
        .in("trial_id", ids).eq("processing_version", hierarchy.processingVersion));
    }
  }
  const storedSession = await checked(client.from("behavioral_sessions").select("*").eq("id", session.sessionId).single());
  const storedTask = await checked(client.from("behavioral_task_sessions").select("*").eq("id", task.taskSessionId).single());
  if (!matchesFields(storedSession, { id: sessionRow.id, participant_id: participantId,
    source_result_id: sessionRow.source_result_id, session_status: sessionRow.session_status })) fail("session not acknowledged");
  if (!matchesFields(storedTask, { id: taskRow.id, session_id: sessionRow.id, task_code: taskRow.task_code,
    total_trials: taskRow.total_trials, completion_status: taskRow.completion_status,
    raw_task_data: taskRow.raw_task_data })) fail("task not acknowledged");
  const currentRows = (await readBehavioralDerivations(client, trialIds)).filter((row) => row.is_current);
  if (currentRows.length !== derivedRows.length || derivedRows.some((expected) =>
    !matchesFields(currentRows.find((row) => row.trial_id === expected.trial_id), expected))) fail("current derivation count/content differs");
  return { ...hierarchy, participant: { researchParticipantId: participantId },
    verification: { expectedTrialCount: hierarchy.trials.length, verifiedTrialCount: rawRows.length,
      processingVersion: hierarchy.processingVersion } };
}

export function researchInputFromHierarchy(hierarchy, participantId, storedRows = []) {
  const reconciled = reconcileBehavioralTrials(hierarchy, storedRows);
  const task = reconciled.taskSession;
  return {
    participantId, sessionId: reconciled.session.sessionId,
    taskSession: { id: task.taskSessionId, session_id: reconciled.session.sessionId,
      task_code: task.taskCode, task_name: task.taskName, completion_status: task.completionStatus,
      difficulty: task.difficulty, started_at: task.startedAt, completed_at: task.completedAt, total_trials: task.totalTrials },
    trials: behavioralDerivationRows(reconciled, participantId),
    rawTrials: reconciled.trials.map((trial) => storedRows.find((row) => row.id === trial.trialId) || ({
      id: trial.trialId, source_trial_key: trial.sourceTrialKey, trial_index: trial.trialIndex,
      occurred_at: trial.occurredAt, raw_data: trial.rawData, raw_schema_version: reconciled.schemaVersion,
    })),
    sessionMetadata: { assessment_or_training: reconciled.session.assessmentOrTraining,
      session_started_at: reconciled.session.startedAt, session_completed_at: reconciled.session.completedAt,
      session_status: reconciled.session.sessionStatus },
  };
}

const withSyncState = (result, syncState, syncStatus = "pending") => ({
  ...result, syncState, syncStatus, rawResult: { ...result.rawResult, syncStatus },
});

// Filter on a short revision, not the potentially multi-megabyte JSON payload.
// The NULL guard also makes first adoption of legacy records compare-and-set.
const atRevision = (query, payload) => payload?.syncState?.revision
  ? query.eq("payload->syncState->>revision", payload.syncState.revision)
  : query.is("payload->syncState->>revision", null);

export async function syncGameResult(client, result, user) {
  if (!result.resultId) fail("stable resultId is required");
  const patientId = result.child?.childId || result.child?.id || result.patient_id || result.patientId;
  const previous = await checked(client.from("game_results").select("*").eq("id", result.resultId).maybeSingle());
  if (previous && (previous.patient_id !== patientId || previous.guardian_id !== user.id)) fail("game result ownership differs");
  const prior = previous ? normalizedStoredResult(previous) : null;
  if (prior?.trials.some((trial, index) => !sameBehavioralData(trial, result.trials?.[index]))) {
    fail("stored raw answers differ; refusing to overwrite acquisition history");
  }
  for (const key of ["trials", "trialLogs", "records", "logs", "history", "rounds"]) {
    const oldHistory = prior?.rawResult?.[key];
    const newHistory = result.rawResult?.[key];
    if (Array.isArray(oldHistory) && Array.isArray(newHistory)
      && oldHistory.some((entry, index) => !sameBehavioralData(entry, newHistory[index]))) {
      fail("stored raw history differs: " + key);
    }
  }
  const initial = buildBehavioralHierarchy({ ...result, behavioral: {
    ...result.behavioral, ...prior?.behavioral,
    trialIds: result.trials?.map((_, index) => prior?.behavioral?.trialIds?.[index] || result.behavioral?.trialIds?.[index]),
  } });
  let normalized = { ...result, behavioral: { sessionId: initial.session.sessionId,
    taskSessionId: initial.taskSession.taskSessionId, trialIds: initial.trials.map((trial) => trial.trialId) } };
  let syncState = { gameResult: "pending", researchHierarchy: "pending", expectedTrialCount: initial.trials.length,
    verifiedTrialCount: null, processingVersion: initial.processingVersion, revision: createBehavioralId() };
  try {
    const row = {
      id: result.resultId, patient_id: patientId, guardian_id: user.id,
      game_id: result.game?.gameId || null, game_name: result.game?.gameName || null,
      mode: result.session?.mode || null, difficulty: result.session?.difficulty || null,
      score: result.summary?.score ?? 0, stars: result.summary?.stars ?? 0, accuracy: result.summary?.accuracy ?? 0,
      avg_reaction_time: result.summary?.avgReactionTime ?? 0, total_trials: result.summary?.totalTrials ?? 0,
      correct_count: result.summary?.correctCount ?? 0, error_count: result.summary?.errorCount ?? 0,
      started_at: result.session?.startedAt || null, finished_at: result.session?.finishedAt || new Date().toISOString(),
      payload: withSyncState(normalized, { ...syncState, gameResult: "saved" }),
    };
    // Compare-and-set protects against a second tab/device replacing a newer
    // checkpoint between our read and write. A concurrent initial insert fails
    // the primary key and retries through the same ownership/content checks.
    const write = previous
      ? atRevision(client.from("game_results").update(row).eq("id", row.id).eq("guardian_id", user.id), previous.payload)
      : client.from("game_results").insert([row]);
    const main = await checked(write.select("*").single());
    if (main?.id !== row.id || !sameBehavioralData(main.payload, row.payload)) fail("game result content not acknowledged");
    syncState = { ...syncState, gameResult: "saved" };
    const prepared = await prepareBehavioralHierarchy(client, normalized);
    const hierarchy = await persistVerifiedBehavioralHierarchy(client, prepared, patientId);
    normalized = { ...normalized, behavioral: { sessionId: hierarchy.session.sessionId,
      taskSessionId: hierarchy.taskSession.taskSessionId, trialIds: hierarchy.trials.map((trial) => trial.trialId) } };
    const verifiedState = { gameResult: "saved", researchHierarchy: "verified", ...hierarchy.verification, revision: syncState.revision };
    const payload = withSyncState(normalized, verifiedState, "synced");
    const completed = await checked(atRevision(client.from("game_results").update({ payload })
      .eq("id", result.resultId).eq("guardian_id", user.id), main.payload).select("*").single());
    if (completed?.id !== row.id || !sameBehavioralData(completed.payload, payload)) fail("final game result not acknowledged");
    return { ...completed, syncState: verifiedState };
  } catch (error) {
    error.syncState = syncState;
    throw error;
  }
}

/** Opt-in historical repair; dryRun performs reads ONLY. Export this plan and a
 * database backup before applying one result with { dryRun: false } as guardian.
 * Old raw rows/keys/IDs and derivation versions are never deleted or rewritten.
 * Retry is safe after any stage. Rollback restores the recorded is_current flags
 * after validating those versions; retain all new raw rows/derivations.
 * No schema/RPC migration or automatic historical batch mutation is required.
 */
export function assertIsolatedRepairExecution(client, execution, user, resultId) {
  if (execution?.environment !== "isolated" || execution?.confirmation !== "APPLY_SINGLE_SYNTHETIC_REPAIR"
    || execution?.resultId !== resultId || execution?.ownerId !== user?.id) fail("explicit isolated repair authorization is required");
  let target;
  try { target = new URL(client.supabaseUrl); } catch { fail("repair client target cannot be verified"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
  const ref = local ? "local" : target.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (target.hostname === "krgvfzjwqijjdwphsyto.supabase.co") fail("production historical repair is blocked");
  if (!ref || ref !== execution.projectRef || target.origin !== execution.targetOrigin
    || (target.protocol !== "https:" && !(local && target.protocol === "http:"))) fail("isolated repair target differs");
  if (!String(resultId).startsWith("p0-acceptance-")) fail("only tagged synthetic repair records are permitted in P0-B");
}

export async function repairStoredBehavioralHierarchy(client, resultId, user, { dryRun = true, execution = null, approvedPlan = null } = {}) {
  if (typeof dryRun !== "boolean") fail("dryRun must be a boolean");
  if (!dryRun) assertIsolatedRepairExecution(client, execution, user, resultId);
  const row = await checked(client.from("game_results").select("*").eq("id", resultId).single());
  const result = normalizedStoredResult(row);
  if (!dryRun && row.guardian_id !== user.id) fail("only the source guardian may apply a repair");
  if (!dryRun && (!approvedPlan?.dryRun || approvedPlan.resultId !== resultId
    || !sameBehavioralData(approvedPlan.sourceSnapshot, row))) fail("a reviewed unchanged dry-run source snapshot is required");
  if (!researchTaskCodeCompatibility(result.game.gameId).writable) fail("unmapped or legacy task requires manual review");
  if (!result.trials.length || Math.max(row.total_trials || 0, result.summary?.totalTrials || 0) > result.trials.length) fail("source payload is missing trials; manual recovery required");
  if (!dryRun && (!approvedPlan.proposedBehavioralIds?.sessionId || !approvedPlan.proposedBehavioralIds?.taskSessionId
    || approvedPlan.proposedBehavioralIds.trialIds?.length !== result.trials.length
    || approvedPlan.proposedBehavioralIds.trialIds.some((id) => !id)
    || new Set(approvedPlan.proposedBehavioralIds.trialIds).size !== result.trials.length)) fail("reviewed identity plan is incomplete");
  const prepared = await prepareBehavioralHierarchy(client, { ...result,
    behavioral: !dryRun ? approvedPlan.proposedBehavioralIds : result.behavioral });
  const sourcePayload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;
  const recordedStart = sourcePayload?.session?.startedAt || row.started_at
    || sourcePayload?.rawResult?.startedAt || sourcePayload?.rawResult?.startTime;
  const sourceStart = isoTimestamp(recordedStart);
  if (recordedStart && !sourceStart) fail("invalid recorded start timestamp requires manual review");
  // Missing historical start times stay unknown; never replace them with finish/now.
  prepared.hierarchy.session.startedAt = sourceStart;
  prepared.hierarchy.taskSession.startedAt = sourceStart;
  if (!dryRun && approvedPlan.processingVersion !== prepared.hierarchy.processingVersion) fail("processing version changed; review a new dry-run");
  const existing = await readBehavioralRows(client, "behavioral_trials", (query) =>
    query.eq("task_session_id", prepared.hierarchy.taskSession.taskSessionId));
  const hierarchy = reconcileBehavioralTrials(prepared.hierarchy, existing);
  const versions = await readBehavioralDerivations(client, existing.map((trial) => trial.id));
  const plan = { resultId, dryRun, expectedTrialCount: hierarchy.trials.length, existingTrialCount: existing.length,
    timestampProvenance: { startedAt: sourceStart ? "recorded" : "not_recorded_preserved_null",
      previousSessionStart: prepared.storedSession?.started_at ?? null,
      previousTaskStart: prepared.storedTask?.started_at ?? null, proposedStart: sourceStart },
    sourceSnapshot: JSON.parse(JSON.stringify(row)),
    proposedBehavioralIds: { sessionId: hierarchy.session.sessionId, taskSessionId: hierarchy.taskSession.taskSessionId,
      trialIds: hierarchy.trials.map((trial) => trial.trialId) },
    processingVersion: hierarchy.processingVersion, retainedTrialIds: existing.map((trial) => trial.id),
    missingTrialIds: hierarchy.trials.filter((trial) => !existing.some((stored) => stored.id === trial.trialId)).map((trial) => trial.trialId),
    previousCurrentVersions: versions.map((version) => ({ trialId: version.trial_id,
      processingVersion: version.processing_version, isCurrent: version.is_current })) };
  if (dryRun) return plan;
  const saved = await persistVerifiedBehavioralHierarchy(client, { ...prepared, hierarchy }, row.patient_id);
  const latest = await checked(client.from("game_results").select("*").eq("id", resultId).single());
  if (!sameBehavioralData(latest, row)) fail("source changed during repair; review and retry the latest source");
  return { ...plan, ...saved.verification, repaired: true, mainSyncStateUpdated: false };
}
