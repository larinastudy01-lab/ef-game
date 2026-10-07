export function getResultCompletionStatus(record = {}) {
  const status = record.completionStatus || record.payload?.session?.status
    || record.session?.status || record.payload?.rawResult?.status
    || record.rawResult?.status || record.status;
  if (status === "aborted") return "interrupted";
  return ["in_progress", "interrupted", "abandoned"].includes(status) ? status : "completed";
}

export const isCompletedResult = (record) => getResultCompletionStatus(record) === "completed";
