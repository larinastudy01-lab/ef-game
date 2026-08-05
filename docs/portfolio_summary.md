# Portfolio Summary — 研究所備審

## Research Problem

學齡前幼兒的遊戲式認知任務常只留下總分，難以重現 trial-level 行為、錯誤型態、反應時間變異、前後段變化與適性推薦過程。本專案將六項既有任務整合成可追溯的研究 prototype，研究資料鏈從 raw trial 延伸至 features、statistics、behavioral prediction、explanation、recommendation 與 longitudinal tracking。

本系統不是醫療診斷系統，也沒有 clinical ground truth 或 normative population dataset。

## My Role

本 Repository 中可驗證的工作範圍包含：

- 稽核並保留既有 React、Node/Express、Supabase、六任務與 task-specific recommendation 架構。
- 建立匿名 Participant → Session → Task Session → Raw/Cleaned Trial schema 與 RLS-compatible additive migrations。
- 設計 feature/statistics/ML/XAI/recommendation/longitudinal/reproducibility 模組與單元測試。
- 建立專業研究頁面與 CSV/JSON research export。
- 將 research ethics、data leakage、simulation labeling 與 unavailable-state disclosure 寫入程式與文件。

這裡描述的是軟體與研究方法 prototype 的完成範圍，不宣稱已完成臨床試驗、介入成效驗證或正式量表效度研究。

## System Architecture

系統採 React professional/parent/child interfaces、Supabase PostgreSQL/Auth/RLS、Node/Express AI/RAG API，以及 `src/analytics/` 下的純函式研究管線。Closed loop 為：Assessment → Trial Data → Quality → Features → Statistics/ML → XAI → Recommendation → Training → New Data → Longitudinal Analysis。

## Data Architecture

- 匿名 research participant 與 identity bridge 分離。
- Raw trial immutable；cleaned/derived trial versioned。
- Trial quality 保存 `valid_trial` 與 exclusion reasons，不直接刪除異常值。
- Task-specific metadata 與 common trial fields 並存。
- Manifest 保存 dataset/feature/code version 與 hierarchy counts。

## Algorithms

- Descriptive/distribution statistics、Pearson/Spearman selection、FDR。
- Early/middle/late、RT variability、error streak、slope、speed–accuracy features。
- Participant-level holdout 與 GroupKFold/StratifiedGroupKFold。
- Random、Rule-based、ε-Greedy、UCB1、Thompson Sampling、diagonal LinUCB prototype。
- Three-session rolling mean/median/sample SD 與 personal-baseline trend。

## Machine Learning

實作 Logistic/Linear Regression、Decision Tree classification/regression 與 sample-gated Random Forest。Targets 限於 future performance、next-assessment performance 與 cross-task performance。Preprocessing 只在 training fold fit；untouched participant test 不參與模型選擇。

目前模型是 behavioral performance research prototype。缺乏外部 validation，不能視為實證預測工具或疾病分類器。

## Explainable AI

線性模型提供 training-mean additive SHAP；樹模型提供 held-out permutation importance 與 local perturbation，並避免錯誤標示為 SHAP。個別 explanation 顯示 feature value 與 positive/negative contribution。Fold importance instability 會揭露，不隱藏。

## Adaptive Training

保留既有 task-specific rules，另建立 baseline-vs-bandit 比較框架、versioned reward、allowed-action difficulty boundary 與 immutable decision/outcome log。Offline simulation 只驗證政策更新與 logging mechanics；結果不是幼兒真實訓練成效。

## Research Methods

- Trial-level behavioral data quality control
- Versioned deterministic feature engineering
- Descriptive and non-parametric-aware statistics
- Participant-level leakage prevention
- Held-out prediction evaluation
- Model explanation and stability disclosure
- Policy simulation and reward logging
- Within-participant longitudinal description
- Reproducibility manifest and experiment registry

## Main Challenges

- 六項遊戲的既有 trial fields 與 difficulty semantics 不一致。
- 必須保留 production-compatible legacy behavior，同時加入可研究的 canonical layer。
- 小樣本下要避免不適當 significance test、neural network、SHAP 宣稱與 mixed-effects 結果。
- Synthetic/Simulation、prototype prediction 與 observed data 必須在 UI、storage、exports 清楚分離。
- Anonymous research IDs、RLS 與可重現 export 必須同時成立。

## Research Limitations

- 樣本量仍有限。
- 沒有 normative population data。
- 沒有 clinical ground truth。
- ML 需要外部 validation 與 calibration。
- Adaptive policy 需要 longitudinal empirical evaluation。
- Simulation 不能代表真實 intervention outcomes。
- Mixed-effects model 目前只有 readiness architecture，尚未 fitted。
- 系統不能取代標準化認知衡鑑或提供臨床診斷。

## Future Research

- 依倫理核准與預先註冊 protocol 蒐集足夠 repeated data。
- 導入合法外部標準量表，重新定義與驗證 prediction target。
- 進行 external validation、calibration、fairness、device robustness 與 missingness analysis。
- 在 nested participant-level validation 中比較更多模型。
- 以實證 longitudinal design 評估 bandit policy 與 reward definition。
- 資料條件足夠後實作 mixed-effects model，但保留 task/difficulty/protocol comparability checks。

