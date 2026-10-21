import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { createAssistantQuestionId, sendAssistantQuestionEmail } from "../utils/assistantEmail";
import "../styles/AssistantEmailControls.css";

export function useAssistantEmail(scopeKey) {
  const [account, setAccount] = useState(null);
  const [enabled, setEnabledState] = useState(false);
  const [deliveries, setDeliveries] = useState({});
  const accountRef = useRef(null);
  const jobsRef = useRef(new Map());
  const inFlightRef = useRef(new Set());
  const enabledRef = useRef(false);
  const scopeRef = useRef(scopeKey);
  scopeRef.current = scopeKey;
  const setEnabled = useCallback((value) => {
    enabledRef.current = value;
    setEnabledState(value);
  }, []);

  useEffect(() => {
    let active = true;
    let authVersion = 0;
    const applySession = (session) => {
      if (!active) return;
      const next = session?.user || null;
      if (accountRef.current?.id !== next?.id || accountRef.current?.email !== next?.email) {
        setEnabled(false);
        setDeliveries({});
        jobsRef.current.clear();
      }
      accountRef.current = next;
      setAccount(next);
    };
    const subscription = supabase.auth.onAuthStateChange((event, session) => {
      authVersion += 1;
      applySession(session);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (authVersion === 0) applySession(error ? null : data?.session);
    }).catch(() => { if (authVersion === 0) applySession(null); });
    return () => {
      active = false;
      subscription?.data?.subscription?.unsubscribe();
    };
  }, [setEnabled]);

  useEffect(() => {
    setEnabled(false);
    setDeliveries({});
    jobsRef.current.clear();
  }, [scopeKey, setEnabled]);

  const takeChoice = useCallback(() => {
    const choice = {
      enabled: enabledRef.current, userId: accountRef.current?.id || null, scopeKey: scopeRef.current,
      requestId: createAssistantQuestionId(), askedAt: new Date().toISOString(),
    };
    setEnabled(false);
    return choice;
  }, [setEnabled]);

  const attempt = useCallback(async (messageId, job) => {
    if (inFlightRef.current.has(messageId)) return;
    inFlightRef.current.add(messageId);
    const update = (delivery) => {
      if (accountRef.current?.id === job.userId) {
        setDeliveries((previous) => ({ ...previous, [messageId]: delivery }));
      }
    };
    update({ status: "pending" });
    try {
      const result = await sendAssistantQuestionEmail(job);
      update({ status: "accepted", recipient: result.recipient });
    } catch (error) {
      update({ status: "failed", message: error.message || "問答寄送失敗，請稍後重試。" });
    } finally {
      inFlightRef.current.delete(messageId);
    }
  }, []);

  const deliver = useCallback((choice, { messageId, question, answer, sources = [], fallback = false }) => {
    if (choice.scopeKey !== scopeRef.current || choice.userId !== (accountRef.current?.id || null)) return;
    if (!choice.enabled) {
      setDeliveries((previous) => ({ ...previous, [messageId]: { status: "not_requested" } }));
      return;
    }
    const job = {
      userId: choice.userId,
      record: { requestId: choice.requestId, askedAt: choice.askedAt, question, answer, sources, fallback },
    };
    jobsRef.current.set(messageId, job);
    void attempt(messageId, job);
  }, [attempt]);

  const retry = useCallback((messageId) => {
    const job = jobsRef.current.get(messageId);
    if (job) void attempt(messageId, job);
  }, [attempt]);

  return { enabled, setEnabled, email: account?.email || "", deliveries, takeChoice, deliver, retry };
}

export function AssistantEmailChoice({ controller, disabled = false }) {
  return (
    <div className="assistant-email-choice">
      <label>
        <input type="checkbox" checked={controller.enabled} disabled={disabled || !controller.email}
          onChange={(event) => controller.setEnabled(event.target.checked)} />
        <span>本次問答自動寄至註冊信箱</span>
      </label>
      <p>{controller.email ? `收件信箱：${controller.email}。每次詢問重新選擇，預設不寄送。` : "登入後可選擇寄至註冊信箱。"}</p>
    </div>
  );
}

export function AssistantEmailStatus({ delivery, onRetry }) {
  if (!delivery) return null;
  return (
    <div className={`assistant-email-status is-${delivery.status}`} role="status">
      {delivery.status === "not_requested" && "本次未寄送"}
      {delivery.status === "pending" && "正在交寄本次問答…"}
      {delivery.status === "accepted" && `已交寄至 ${delivery.recipient}，請查看收件匣或垃圾郵件。`}
      {delivery.status === "failed" && <>{delivery.message}<button type="button" onClick={onRetry}>重試寄送</button></>}
    </div>
  );
}
