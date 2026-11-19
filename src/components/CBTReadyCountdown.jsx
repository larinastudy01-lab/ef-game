import React, { useEffect, useRef, useState } from "react";

export default function CBTReadyCountdown({ onComplete }) {
  const [count, setCount] = useState(5);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (count > 1) setCount(count - 1);
      else onCompleteRef.current();
    }, 1000);
    return () => clearTimeout(timer);
  }, [count]);

  return (
    <div className="cbt-ready-countdown-card">
      <div className="cbt-ready-countdown" role="timer" aria-label="準備倒數">{count}</div>
    </div>
  );
}
