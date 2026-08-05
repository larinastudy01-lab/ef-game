# Behavioral Machine Learning Pipeline — `ml_pipeline_v1`

## Scope and ground-truth audit

The current repository contains anonymous participant IDs, canonical valid trials, `features_v1`, task outcomes and repeated assessments. It does **not** contain an external standardized scale, validated clinical label, or lawful diagnostic ground truth. Therefore this phase models behavioral task performance only. It must not produce healthy/unhealthy, normal/abnormal, ADHD/non-ADHD, patient/healthy-child or diagnostic risk labels.

Permitted targets:

1. `future_accuracy_from_first_20pct|30pct|50pct` and `future_rt_mean_...`: early valid trials are predictors; later valid trials define the outcome.
2. `next_assessment_accuracy|rt_mean|rt_variability_ms`: assessment n predicts the same task at assessment n+1. Training sessions are excluded from target sequencing.
3. `cross_task_<TASK>_<OUTCOME>`: other-task features predict a selected task. All target-task and `overall_*` fields are removed from predictors.
4. Optional performance category uses a declared behavioral threshold. It is not a normative or clinical category.

## Leakage controls

```text
Canonical trials / features_v1
  -> target construction with temporal separation
  -> fixed 20% participant-level untouched test holdout
  -> GroupKFold or StratifiedGroupKFold validation on development participants
  -> fit median imputation on training fold
  -> fit standard scaling on training fold
  -> fit zero-variance feature filter on training fold
  -> train model (class weighting/bootstrap only inside training fold)
  -> transform and evaluate held-out participants
  -> versioned experiment record
```

The outer test participants never enter development, preprocessing fitting or cross-validation. `assertParticipantIsolation` also fails immediately if a participant is present on both sides of an inner fold. After validation, the selected baseline configuration is refitted on development participants and evaluated once on the untouched test participants. Preprocessor records its fitting participants for audit. No trial-level random split exists.

## Models

Baseline classification: Logistic Regression, class-weighted Logistic Regression, Decision Tree.  
Baseline regression: Linear Regression, Decision Tree Regressor.  
Comparison: Random Forest is enabled only at 30 or more participants. Bootstrap samples are drawn only from the current training fold.

XGBoost, SVM, KNN and MLP are explicitly reported as skipped in v1. They require dependency review, participant-count justification and a predeclared tuning design. MLP is not added merely for complexity.

## Evaluation

Classification reports original class distribution, accuracy, balanced accuracy, precision, recall, F1, ROC-AUC when both classes exist, PR-AUC and confusion matrix per fold. The experiment table contains averaged scalar CV metrics. Class weights are calculated inside each training fold.

Regression reports MAE, RMSE and R². A null R² means the held-out outcome has zero variance.

## Experiment tracking

Each experiment stores `experiment_id`, dataset/feature/pipeline version, target definition/type, model, hyperparameters, seed, split method, train/validation/test participant manifests, metrics, original class distribution, training time/timestamp and code/model version. Apply `20260730_phase4_ml_experiment_tracking.sql` to enable Supabase persistence. RLS permits an authorized professional to insert/select their own experiment metadata.

The migration is additive and does not change behavioral data. Rollback is `drop table if exists public.ml_experiments;` and removes experiment metadata only.

## Demo mode

`generateSyntheticDataset` creates deterministic IDs beginning `SYNTHETIC_`. Demo output is always labeled `DEMO / SYNTHETIC DATA — pipeline validation only; not a research result.` Synthetic records cannot be persisted through `persistExperiment`.

## Interpretation limits

- A prediction is an association/pattern estimate, not diagnosis, causation, or evidence that training improves performance.
- Small samples may validate software execution but do not validate generalization.
- Hyperparameter tuning is intentionally absent in v1; when added, it requires nested participant-grouped validation.
- Performance categories require a preregistered research definition and sensitivity analysis before substantive interpretation.
