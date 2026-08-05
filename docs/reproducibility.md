# Research Reproducibility and Export

## Unified export

`buildUnifiedResearchExport` creates a set of independent files rather than a merged opaque dataset:

| File | Unit | Source |
| --- | --- | --- |
| `raw_trial_data.csv` | Raw trial | Immutable `behavioral_trials.raw_data` |
| `cleaned_trial_data.csv` | Versioned trial interpretation | Current `behavioral_trial_derivations` |
| `task_features.csv` | Participant × task session | `features_v1` |
| `participant_features.csv` | Participant × session | Cross-task feature builder |
| `statistics_*.csv` | Statistical result | `statistics_v1` reports |
| `ml_predictions.csv` | Untouched-test prediction | `ml_pipeline_v1` / XAI artifact |
| `shap_results.csv` | Global/individual contribution | Linear SHAP when applicable; tree perturbation is not mislabeled SHAP |
| `recommendation_decisions.csv` | Recommendation decision | Phase 6 observed decision log |
| `longitudinal_features.csv` | Participant × task × metric | `longitudinal_v1` |
| `experiment_registry.csv/json` | Experiment | Phase 4/9 registry |
| `dataset_manifest.json` | Export manifest | Counts and versions computed at export |
| `export_metadata.json` | Bundle metadata | Format, separation and interpretation guardrail |

CSV nested fields are JSON-serialized and escaped. Empty artifacts remain empty files; the export layer does not synthesize rows to make a dataset look complete.

## Dataset manifest

Required fields:

```json
{
  "dataset_version": "behavioral_dataset_v1",
  "generated_at": "ISO-8601",
  "participant_count": 0,
  "session_count": 0,
  "task_count": 0,
  "trial_count": 0,
  "excluded_trial_count": 0,
  "feature_version": "features_v1",
  "code_version": "git-commit-or-release-tag"
}
```

`task_count` means task-session count; `unique_task_code_count` separately reports represented task types. `trial_count` uses immutable raw trials. `excluded_trial_count` uses current cleaned derivations with `valid_trial=false`; excluded records remain in cleaned export.

Set `REACT_APP_CODE_VERSION` to the exact commit or release tag before building. If absent, manifest records `repository_worktree_unknown` rather than inventing a version.

## Experiment registry

Each new experiment records:

- experiment ID and research question;
- dataset/feature versions;
- target and model;
- hyperparameters and seed;
- participant holdout + grouped cross-validation;
- metrics;
- result path;
- timestamp.

Migration `20260730_phase9_experiment_registry.sql` adds nullable `research_question` and `result_path` to preserve legacy Phase 4 records. New Phase 4 records populate both automatically. Incomplete legacy entries are excluded from registry export until metadata is curated; they are not silently filled with unsupported claims.

## Reproduction checklist

1. Record exact code commit in `REACT_APP_CODE_VERSION`.
2. Apply migrations in filename order.
3. Confirm RLS-authorized participant scope.
4. Export and retain manifest with all CSV files.
5. Verify raw/cleaned trial counts and exclusions.
6. Match feature, processing, model, policy and reward versions.
7. Verify participant-level holdout/grouped CV manifests before interpreting metrics.
8. Keep Synthetic/Simulation artifacts separate from observed data.
9. Report unavailable data and instability rather than substituting values.
10. Preserve the ethics/disclaimer text with research reports.
