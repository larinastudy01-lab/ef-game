# Research & Professional Dashboard — `professional_dashboard_v1`

## Purpose and information architecture

The professional route `/research-professional-dashboard` is a research workspace, not a commercial health dashboard. Its navigation follows the evidence chain:

```text
Raw Behavior → Feature → Trend → Model → Explanation → Recommendation
```

Sections:

1. Overview
2. Task Performance
3. Behavioral Analysis
4. Statistical Analysis
5. AI Prediction
6. Explainable AI
7. Adaptive Training
8. Longitudinal Tracking
9. Research Data
10. Model / Experiment Info

The existing specialist pages remain available for deeper statistics, policy simulation and longitudinal review. The large existing professional dashboard was not destructively rewritten.

## Data provenance by section

- Overview uses the selected anonymous participant’s latest assessment and canonical Phase 2 features.
- Task Performance shows the six existing tasks separately and discovers only actual numeric task-specific features.
- Behavioral Analysis uses Phase 1 canonical trial derivations for RT/trial/error patterns and Phase 2 early/late/stability features.
- Statistical Analysis runs `statistics_v1` for the selected participant and links to the full research statistics page.
- AI Prediction fits observed data only when at least 20 participants form the declared future-performance target. It does not substitute synthetic performance in this unified page.
- Explainable AI uses the validation-selected model. Individual output is displayed only when the selected participant belongs to the untouched test subset.
- Adaptive Training reads observed Phase 6 decision logs. Simulation is kept on the separate policy research page.
- Longitudinal Tracking uses `longitudinal_v1` personal-baseline series and links to the full longitudinal page.
- Experiment Info reads persisted Phase 4 metadata when the migration is available; otherwise it shows in-memory versions or “Not persisted”.

## Research exports

Exports are scoped to the currently selected anonymous participant:

- `raw_trials.csv`: immutable Phase 1 acquisition payload plus anonymous hierarchy IDs and raw schema version.
- `task_features.csv`: Phase 2 participant × task × session feature rows.
- `participant_features.csv`: Phase 2 cross-task participant-session rows.
- `statistics.csv`: Phase 3 statistics summary.
- `prediction.csv`: selected participant’s untouched-test prediction only, when available.
- `recommendation.csv`: observed Phase 6 decision/outcome records.

Nested values are JSON-serialized and CSV-escaped. Names, nickname, email and other direct identifiers are not added. Raw and derived exports remain separate so feature/statistical/model changes do not rewrite acquisition data.

## Interpretation and unavailable states

The interface does not use normal/abnormal traffic lights, disease-risk percentages, diagnosis conclusions or normative child comparisons. It uses behavioral pattern, relative performance, personal trend, model prediction and research interpretation language.

Missing migrations, insufficient sample size, absent repeated sessions and non-test-set individual predictions are shown as unavailable states. The dashboard does not generate replacement values merely to fill a card.

