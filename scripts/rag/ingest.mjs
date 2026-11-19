// Build only one bounded batch of embeddings at a time. A failed batch is
// propagated to the importer, which rolls back its newly created document.
export async function withDocumentRollback({ documentId, createDocument, writeChunks, deleteDocument }) {
  try {
    await createDocument(documentId);
    return await writeChunks(documentId);
  } catch (error) {
    // The insert can commit before a network failure hides its response.
    // A client-generated ID lets us clean up that exact document as well.
    await deleteDocument(documentId);
    throw error;
  }
}

export async function writeChunkBatches({ chunks, createRow, insertRows, onProgress = () => {}, batchSize = 16, embeddingConcurrency = 4 }) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 64) {
    throw new Error("IMPORT_BATCH_SIZE must be an integer between 1 and 64.");
  }
  if (!Number.isInteger(embeddingConcurrency) || embeddingConcurrency < 1 || embeddingConcurrency > 8) {
    throw new Error("IMPORT_EMBEDDING_CONCURRENCY must be an integer between 1 and 8.");
  }
  for (let offset = 0; offset < chunks.length; offset += batchSize) {
    const end = Math.min(chunks.length, offset + batchSize);
    const rows = [];
    for (let start = offset; start < end; start += embeddingConcurrency) {
      const groupEnd = Math.min(end, start + embeddingConcurrency);
      const group = Array.from({ length: groupEnd - start }, (_, index) => start + index);
      rows.push(...await Promise.all(group.map(index => createRow(chunks[index], index))));
    }
    await insertRows(rows);
    onProgress(end, chunks.length);
  }
}
