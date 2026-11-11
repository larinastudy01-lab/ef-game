// In-memory PostgREST contract double. Never imports a real Supabase client.
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
export function createBehavioralStore() {
  const store = { tables: Object.fromEntries(["profiles", "patients", "game_results", "research_participants",
    "behavioral_sessions", "behavioral_task_sessions", "behavioral_trials", "behavioral_trial_derivations"]
    .map((table) => [table, []])), hooks: [], writes: [], sequence: 0, maxRows: 1000 };
  store.once = (table, operation, effect) => store.hooks.push({ table, operation, effect });
  const field = (row, key) => key === "payload->syncState->>revision" ? row.payload?.syncState?.revision ?? null : row[key];
  class Query {
    constructor(table) { this.table = table; this.operation = "read"; this.filters = []; }
    select(selection = "*") { this.selection = selection; return this; }
    eq(key, value) { this.filters.push((row) => field(row, key) === value); return this; }
    is(key, value) { this.filters.push((row) => field(row, key) === value); return this; }
    neq(key, value) { this.filters.push((row) => row[key] !== value); return this; }
    in(key, values) { this.filters.push((row) => values.includes(row[key])); return this; }
    order(key, { ascending = true } = {}) { this.sortKey = key; this.ascending = ascending; return this; }
    range(start, end) { this.bounds = [start, end]; return this; }
    upsert(values, options = {}) { this.operation = "upsert"; this.values = Array.isArray(values) ? values : [values]; this.options = options; return this; }
    insert(values) { this.operation = "insert"; this.values = Array.isArray(values) ? values : [values]; this.options = {}; return this; }
    update(values) { this.operation = "update"; this.values = values; return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.one = true; this.optional = true; return this; }
    then(resolve, reject) { this.promise ||= Promise.resolve().then(() => this.execute()); return this.promise.then(resolve, reject); }
    execute() {
      try {
        const hookIndex = store.hooks.findIndex((hook) => hook.table === this.table && hook.operation === this.operation);
        if (hookIndex >= 0) {
          const hook = store.hooks.splice(hookIndex, 1)[0];
          const response = hook.effect(this, store);
          if (response) return response;
        }
        const table = store.tables[this.table];
        if (!table) throw new Error("Unknown table " + this.table);
        let affected;
        const matches = (row) => this.filters.every((filter) => filter(row));
        if (this.operation === "upsert" || this.operation === "insert") {
          const next = clone(table);
          affected = [];
          for (const input of this.values) {
            const keys = (this.options.onConflict || "id").split(",");
            let row = next.find((item) => keys.every((key) => item[key] === input[key]));
            if (row && this.operation === "insert") throw new Error("Primary key conflict");
            if (row && this.options.ignoreDuplicates) { affected.push(row); continue; }
            if (this.table === "behavioral_trials" && row) throw new Error("Raw rows are immutable");
            if (row) Object.assign(row, clone(input));
            else { row = { id: input.id || "generated-" + (++store.sequence), ...clone(input) }; next.push(row); }
            affected.push(row);
          }
          this.validate(next);
          table.splice(0, table.length, ...next);
          store.writes.push({ table: this.table, operation: this.operation, values: clone(this.values) });
        } else if (this.operation === "update") {
          const next = clone(table);
          affected = next.filter(matches).map((row) => Object.assign(row, clone(this.values)));
          this.validate(next);
          table.splice(0, table.length, ...next);
          store.writes.push({ table: this.table, operation: this.operation, values: clone(this.values) });
        } else affected = table.filter(matches);
        if (this.table === "behavioral_task_sessions" && this.selection?.includes("behavioral_sessions!inner")) {
          affected = affected.map((row) => ({ ...row,
            behavioral_sessions: store.tables.behavioral_sessions.find((session) => session.id === row.session_id),
            behavioral_trials: store.tables.behavioral_trials.filter((trial) => trial.task_session_id === row.id).slice(0, store.maxRows)
              .map((trial) => ({ ...trial, behavioral_trial_derivations: store.tables.behavioral_trial_derivations.filter((derived) => derived.trial_id === trial.id) })),
          }));
        }
        affected = clone(affected);
        if (this.sortKey) affected.sort((a, b) => String(a[this.sortKey]).localeCompare(String(b[this.sortKey])) * (this.ascending ? 1 : -1));
        const [start, end] = this.bounds || [0, store.maxRows - 1];
        affected = affected.slice(start, Math.min(end + 1, start + store.maxRows));
        if (this.one) {
          if (affected.length === 0 && this.optional) return { data: null, error: null };
          if (affected.length !== 1) throw new Error("Expected one row in " + this.table);
          return { data: affected[0], error: null };
        }
        return { data: affected, error: null };
      } catch (error) { return { data: null, error }; }
    }
    validate(rows) {
      const seen = new Set();
      for (const row of rows) {
        let unique;
        if (this.table === "behavioral_sessions") {
          if (!store.tables.game_results.some((main) => main.id === row.source_result_id)) throw new Error("Session result FK");
          unique = row.source_result_id;
        }
        if (this.table === "behavioral_task_sessions") unique = row.session_id + ":" + row.task_order_index;
        if (this.table === "behavioral_trials") {
          if (!store.tables.behavioral_task_sessions.some((task) => task.id === row.task_session_id)) throw new Error("Trial task FK");
          unique = row.task_session_id + ":" + row.source_trial_key;
        }
        if (this.table === "behavioral_trial_derivations") {
          if (!store.tables.behavioral_trials.some((trial) => trial.id === row.trial_id)) throw new Error("Derivation trial FK");
          unique = row.is_current ? row.trial_id : undefined;
        }
        if (unique !== undefined && seen.has(unique)) throw new Error("Unique constraint " + this.table);
        seen.add(unique);
      }
    }
  }
  store.client = { from: jest.fn((table) => new Query(table)) };
  return store;
}

export function behavioralResult(task = "LB", count = 20) {
  const trials = Array.from({ length: count }, (_, index) => task === "LB" ? {
    stageId: index < 10 ? "forward" : "red-blue", stepIndex: index % 10,
    expectedKey: "key-" + index, clickedKey: "key-" + index, isCorrect: true, reactionTime: 500,
  } : { trialNumber: index + 1, isCorrect: true, correctIds: ["a"], selectedIds: ["a"], reactionTime: 1000, deselectCount: 1 });
  return { resultId: "stable-attempt", child: { childId: "child-1" }, game: { gameId: task },
    session: { mode: "test", status: "completed", startedAt: "2026-10-07T00:00:00Z", finishedAt: "2026-10-07T00:02:00Z" },
    summary: { totalTrials: count, correctCount: count, accuracy: 100 },
    behavioral: { sessionId: "session-1", taskSessionId: "task-1", trialIds: trials.map((_, index) => "trial-" + index) },
    trials, rawResult: { trialLogs: clone(trials), score: 100 } };
}
