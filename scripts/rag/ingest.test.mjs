import assert from "node:assert/strict";
import test from "node:test";
import { withDocumentRollback, writeChunkBatches } from "./ingest.mjs";

test("a lost insert response rolls back the committed document using its known ID", async () => {
  const documents = new Set(["existing-document"]);
  await assert.rejects(withDocumentRollback({
    documentId: "new-document",
    createDocument: async id => { documents.add(id); throw new Error("response lost after commit"); },
    writeChunks: () => assert.fail("must not write chunks after insert failure"),
    deleteDocument: async id => { documents.delete(id); },
  }), /response lost after commit/);
  assert.deepEqual([...documents], ["existing-document"]);
});

test("chunk failures clean up only the newly created document", async () => {
  const documents = new Set(["existing-document"]);
  await assert.rejects(withDocumentRollback({
    documentId: "new-document",
    createDocument: async id => { documents.add(id); },
    writeChunks: async () => { throw new Error("partial chunk failure"); },
    deleteDocument: async id => { documents.delete(id); },
  }), /partial chunk failure/);
  assert.deepEqual([...documents], ["existing-document"]);
});

test("successful documents are retained and return the import result", async () => {
  const result = await withDocumentRollback({
    documentId: "new-document",
    createDocument: async () => {},
    writeChunks: async () => 23,
    deleteDocument: () => assert.fail("must retain successful document"),
  });
  assert.equal(result, 23);
});

test("batched import preserves chunk indexes and writes the final incomplete batch", async () => {
  const batches = [];
  const progress = [];
  await writeChunkBatches({
    chunks: ["a", "b", "c", "d", "e"], batchSize: 2,
    createRow: async (content, chunk_index) => ({ content, chunk_index }),
    insertRows: async rows => { batches.push(rows); },
    onProgress: count => progress.push(count),
  });
  assert.deepEqual(batches.map(batch => batch.length), [2, 2, 1]);
  assert.deepEqual(batches.flat().map(row => row.chunk_index), [0, 1, 2, 3, 4]);
  assert.deepEqual(batches.flat().map(row => row.content), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(progress, [2, 4, 5]);
});

for (const failingStep of ["embedding", "database"]) {
  test(`a failed ${failingStep} stops later writes and propagates to document rollback`, async () => {
    const prepared = [];
    const written = [];
    const progress = [];
    await assert.rejects(writeChunkBatches({
      chunks: ["a", "b", "c", "d", "e"], batchSize: 2,
      createRow: async (content, index) => {
        prepared.push(index);
        if (failingStep === "embedding" && index === 3) throw new Error("synthetic failure");
        return { content, index };
      },
      insertRows: async rows => {
        if (failingStep === "database" && rows[0].index === 2) throw new Error("synthetic failure");
        written.push(...rows.map(row => row.index));
      },
      onProgress: count => progress.push(count),
    }), /synthetic failure/);
    assert.deepEqual(written, [0, 1]);
    assert.ok(!prepared.includes(4));
    assert.deepEqual(progress, [2]);
  });
}

test("invalid batch sizes fail before generating or writing any embeddings", async () => {
  for (const batchSize of [0, -1, 65, 1.5, NaN]) {
    await assert.rejects(writeChunkBatches({
      chunks: ["a"], batchSize,
      createRow: () => assert.fail("must not embed"),
      insertRows: () => assert.fail("must not insert"),
    }), /IMPORT_BATCH_SIZE/);
  }
});

test("embedding work is bounded and out-of-order completion preserves chunk indexes", async () => {
  let active = 0;
  let peak = 0;
  const written = [];
  await writeChunkBatches({
    chunks: [0, 1, 2, 3, 4, 5, 6], batchSize: 5, embeddingConcurrency: 2,
    createRow: async (_, index) => {
      peak = Math.max(peak, ++active);
      await new Promise(resolve => setTimeout(resolve, index % 2 ? 1 : 5));
      active--;
      return { index };
    },
    insertRows: async rows => { written.push(...rows.map(row => row.index)); },
  });
  assert.equal(peak, 2);
  assert.equal(active, 0);
  assert.deepEqual(written, [0, 1, 2, 3, 4, 5, 6]);
});

test("invalid concurrency fails before any model or database work", async () => {
  for (const embeddingConcurrency of [0, -1, 9, 1.5, NaN]) {
    await assert.rejects(writeChunkBatches({
      chunks: ["a"], embeddingConcurrency,
      createRow: () => assert.fail("must not embed"),
      insertRows: () => assert.fail("must not insert"),
    }), /IMPORT_EMBEDDING_CONCURRENCY/);
  }
});
