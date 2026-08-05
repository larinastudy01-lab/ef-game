import { useEffect, useState } from "react";

const STORAGE_KEY = "ef_temporary_test_unlock";
const TEST_PASSWORD = "EF2026";

export default function useTemporaryTestUnlock() {
  const [isTestUnlockEnabled, setIsTestUnlockEnabled] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) === "true"
  );

  useEffect(() => {
    const handleShortcut = (event) => {
      if (!(event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "u")) return;

      event.preventDefault();

      if (isTestUnlockEnabled) {
        sessionStorage.removeItem(STORAGE_KEY);
        setIsTestUnlockEnabled(false);
        window.alert("測試解鎖模式已關閉");
        return;
      }

      const password = window.prompt("請輸入測試解鎖密碼：");
      if (password === null) return;

      if (password !== TEST_PASSWORD) {
        window.alert("密碼錯誤");
        return;
      }

      sessionStorage.setItem(STORAGE_KEY, "true");
      setIsTestUnlockEnabled(true);
      window.alert("測試解鎖模式已開啟，可任選測驗或訓練關卡");
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [isTestUnlockEnabled]);

  return isTestUnlockEnabled;
}
