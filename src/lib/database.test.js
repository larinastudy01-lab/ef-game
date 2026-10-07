import { saveGameResultToCloud } from "./database";
import { supabase } from "./supabaseClient";

jest.mock("./supabaseClient", () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));

let query;
const record = {
  resultId: "stable-attempt", child: { childId: "child-1" },
  game: { gameId: "CBT" }, session: { mode: "test", status: "interrupted" },
  summary: { score: 0 }, rawResult: { status: "interrupted", syncStatus: "pending" },
};
beforeEach(() => {
  jest.clearAllMocks();
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-a" } } });
  query = { upsert: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: { id: record.resultId } }) };
  supabase.from.mockImplementation((table) => {
    if (table === "game_results") return query;
    throw new Error("Behavioral migration not installed");
  });
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test("an account change before upload never writes under the other account", async () => {
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: "owner-b" } } });
  expect(await saveGameResultToCloud(record, { expectedOwnerId: "owner-a" })).toBeNull();
  expect(supabase.from).not.toHaveBeenCalled();
});

test("cloud acknowledgements preserve interruption and use the same ID for upsert", async () => {
  expect(await saveGameResultToCloud(record, { expectedOwnerId: "owner-a" })).toEqual({ id: record.resultId });
  expect(query.upsert).toHaveBeenCalledWith([expect.objectContaining({
    id: record.resultId, guardian_id: "owner-a", patient_id: "child-1",
    payload: expect.objectContaining({
      syncStatus: "synced", session: expect.objectContaining({ status: "interrupted" }),
    }),
  })], { onConflict: "id" });
});

test("a database error rejects the upload so its local queue record is retained", async () => {
  query.single.mockResolvedValue({ data: null, error: new Error("RLS denied") });
  await expect(saveGameResultToCloud(record, { expectedOwnerId: "owner-a" })).rejects.toThrow("RLS denied");
});
