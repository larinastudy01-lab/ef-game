# Explainable AI for Behavioral Performance — `explainability_v1`

## Purpose

This module answers why the selected behavioral performance model produced its prediction. It does not explain disease, diagnose a child, establish cause, or claim that training improves performance.

The model is selected using Phase 4 development-set participant-grouped validation only. Untouched test performance is never used to select the model.

## Global explanation

- Linear/Logistic Regression: absolute standardized coefficients provide global importance and retain coefficient direction. A SHAP summary additionally aggregates mean absolute and signed additive contributions across untouched test rows, with its training-mean reference and prediction/log-odds output scale shown.
- Decision Tree/Random Forest: held-out permutation importance measures the increase in RMSE or decrease in balanced accuracy after shuffling one feature.
- Features and rankings are generated from the fitted model and observed input columns; no task or behavioral feature is predeclared as important.

## Individual explanation

- Linear Regression: `contribution_j = standardized_value_j × coefficient_j`. The intercept is the training-mean reference prediction.
- Logistic Regression: the same additive relationship is reported on log-odds. Probability is the sigmoid of intercept plus contributions.
- Tree models: each feature is replaced by its training reference value (standardized zero); contribution is the full prediction minus this perturbed prediction.

Linear additive values are described as SHAP values only under the declared training-mean reference assumptions. Tree perturbation is explicitly **not** labeled SHAP.

Individual output contains anonymous participant/session IDs, prediction, probability/confidence when applicable, positive/negative contributors and original feature values. Generated language is restricted to behavioral associations and prediction influence.

## Stability validation

The selected model family is refitted across participant-grouped validation folds. Each feature receives fold ranks, rank range and importance coefficient of variation. Among the top ten features:

- `stable`: at least 70% have rank range ≤ 2
- `mixed`: 40–69%
- `unstable`: below 40%

The dashboard always displays the label and disclosure. An unstable ranking is not hidden or converted into a single reassuring score.

## Dashboard and limitations

Professional-only route: `/ai-behavioral-analysis`. It displays prediction, held-out model performance, global and individual explanations, importance stability, model/data/feature version, sample size and validation method.

If fewer than 20 observed participants can form the selected future-performance dataset, the page uses deterministic demo data and prominently displays `DEMO / SYNTHETIC DATA`. Synthetic performance is not a research result and cannot be persisted as an observed experiment.

Required notice: **模型目前僅供研究用途，其結果尚未完成臨床效度驗證。**
