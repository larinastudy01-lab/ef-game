# Behavioral Feature Dictionary — `features_v1`

Pipeline: `behavioral-features-js-1.0.0`  
Unit of task-level analysis: Participant × Task × Session  
Input: Phase 1 `behavioral_trial_derivations`, using only the declared `processing_version` and `valid_trial=true` rows.

> 「fatigue-related」欄位只描述 late-session behavioral change，不是疲勞、疾病或臨床診斷。

## Reproducibility contract

- Formula changes require a new `feature_version`; `features_v1` must never silently change.
- Rows retain `source_processing_versions`, `feature_version`, and `pipeline_version`.
- Sorting is by canonical `trial_index` before temporal calculation.
- Invalid trials are excluded from feature values but remain represented by quality counts.
- Interrupted/abandoned task sessions have zero analytical trials.
- Missing RT remains `null`; it is never imputed to zero.
- No participant name, `patient_id`, guardian ID, email, or birth date is accepted by dataset builders.

## Mathematical notation

For valid analytical trials, let:

- `n` = number of valid analytical trials.
- `yᵢ` = correctness, 1 correct and 0 incorrect.
- `rᵢ` = reaction time in milliseconds when observed.
- `nᵧ` = trials with known correctness.
- `nᵣ` = trials with observed RT.

Sample standard deviation uses denominator `n-1`. For one observation SD is `0`; for no observations it is `null`. Quartiles use linearly interpolated positions `(n-1)p`.

## Quality and general performance features

| Feature | Type | Unit | Definition / Formula | Research meaning |
|---|---|---|---|---|
| `total_trial_count` | integer | count | All Phase 1 derivations presented to pipeline | Acquisition volume |
| `analysis_trial_count` | integer | count | Valid trials used | Effective analytical sample |
| `excluded_trial_count` | integer | count | total − analysis | Quality loss |
| `valid_trial_rate` | number | proportion | analysis / total | Usable-data proportion |
| `exclusion_reason_counts` | object | count by reason | Count of every Phase 1 exclusion code | Transparent quality audit |
| `accuracy` | number | proportion | `Σyᵢ / nᵧ` | Correct-response proportion |
| `error_rate` | number | proportion | `Σ(1-yᵢ) / nᵧ` | Incorrect-response proportion |
| `correct_trial_count` | integer | count | `Σyᵢ` | Correct trial count |
| `incorrect_trial_count` | integer | count | `Σ(1-yᵢ)` | Incorrect trial count |

## RT descriptive feature families

Each prefix below emits `count`, `mean`, `median`, `sd`, `min`, `max`, `iqr`, and `cv`:

| Prefix | Included RT | Formula notes |
|---|---|---|
| `rt_*` | All valid observed RT | Main latency distribution |
| `correct_rt_*` | Correct trials with RT | Correct-response latency |
| `incorrect_rt_*` | Incorrect trials with RT | Error-response latency |

Formulas:

- Mean: `Σrᵢ / nᵣ`
- Median: middle ordered RT; mean of two middle values for even `nᵣ`
- SD: `sqrt(Σ(rᵢ-r̄)²/(nᵣ-1))`
- IQR: `Q3 − Q1`
- CV: `SD / mean`; null when mean is zero/missing

## Stability features

| Feature | Unit | Formula | Meaning |
|---|---|---|---|
| `rt_variability_ms` | ms | Sample SD of observed RT | RT variability, retained separately from any composite |
| `accuracy_variability` | binary scale | Sample SD of `yᵢ` | Correctness variability |
| `mean_trial_to_trial_rt_change_ms` | ms | Mean of `rᵢ-rᵢ₋₁` for adjacent observed pairs | Signed local RT change |
| `mean_absolute_trial_to_trial_rt_change_ms` | ms | Mean of `|rᵢ-rᵢ₋₁|` | Magnitude of local instability |
| `error_streak_count` | count | Number of contiguous incorrect runs | Error clustering |
| `maximum_error_streak` | count | Longest contiguous incorrect run | Maximum sustained error sequence |
| `response_consistency` | proportion | Most frequent serialized actual response / responses observed | Response-pattern concentration; interpretation depends on task balance |

## Temporal and late-session change features

Trials are sorted by `trial_index`. Edge size is `max(1, floor(n×0.25))`; first and last edge-size trials are early/late, remaining trials are middle. With very small `n`, early/late can overlap and must be interpreted cautiously.

| Feature | Unit | Formula |
|---|---|---|
| `early/middle/late_trial_count` | count | Trials in segment |
| `early/middle/late_accuracy` | proportion | Segment accuracy |
| `early/middle/late_rt_mean_ms` | ms | Segment mean observed RT |
| `accuracy_change_late_minus_early` | proportion difference | late accuracy − early accuracy |
| `rt_change_late_minus_early_ms` | ms | late mean RT − early mean RT |
| `rt_slope_ms_per_trial` | ms/trial | OLS slope of RT on zero-based trial order |
| `performance_slope_per_trial` | correctness/trial | OLS slope of binary correctness on trial order |
| `learning_related_accuracy_change` | proportion difference | Same transparent base difference: late − early accuracy |
| `learning_related_rt_improvement_ms` | ms | early RT − late RT; descriptive only |
| `fatigue_related_accuracy_drop` | proportion difference | `max(early accuracy − late accuracy, 0)` |
| `fatigue_related_rt_slowing_ms` | ms | `max(late RT − early RT, 0)` |

The last two are fatigue-related behavioral indicators only. Positive values can also reflect task difficulty, strategy, interruptions, motivation, device effects, or order effects.

## Speed–accuracy relationship

| Feature | Unit | Formula | Limitation |
|---|---|---|---|
| `rt_accuracy_correlation` | correlation | Pearson correlation between RT and binary correctness on paired trials | Null when variance/sample is insufficient; not causal |
| `inverse_efficiency_ms` | ms | mean RT / accuracy | Null when accuracy is zero/missing |
| `correct_responses_per_second` | 1/s | accuracy / (mean RT / 1000) | Efficiency indicator; accuracy and RT remain available separately |

## Task-specific features

### Corsi Block Tapping (`CBT`)

Derived only from recorded `memorySpan/sequenceLength`, target/user sequences, hint/replay and tap timings.

| Feature | Definition |
|---|---|
| `cbt_max_correct_span` | Maximum recorded span/sequence length on a correct trial |
| `cbt_max_attempted_span` | Maximum recorded attempted span |
| `cbt_accuracy_by_sequence_length` | Trial count and accuracy keyed by observed sequence length |
| `cbt_hint_trial_rate` | Trials with `usedHint` or `idleHintShown` / trials |
| `cbt_replay_trial_rate` | Trials with `usedReplay` / trials |
| `cbt_mean_first_tap_time_ms` | Mean recorded first-tap latency |
| `cbt_mean_tap_interval_ms` | Mean recorded within-sequence average tap interval |

### Picture Memory (`PM`)

| Feature | Definition |
|---|---|
| `pm_max_correct_memory_load` | Maximum `memoryCount/memorySpan` completed correctly |
| `pm_accuracy_by_memory_load` | Count/accuracy for each observed memory load |
| `pm_accuracy_by_difficulty` | Count/accuracy for each observed task difficulty |
| `pm_timeout_rate` | Timeout trials / trials |
| `pm_mean_wrong_tap_count` | Mean recorded wrong selections |
| `pm_mean_missed_target_count` | Mean target images not selected |
| `pm_mean_deselect_count` | Mean deselection count |

### Simple Reaction Task (`SRT`)

| Feature | Definition |
|---|---|
| `srt_go_accuracy` | Accuracy for non-rotten targets |
| `srt_no_go_accuracy` | Accuracy for rotten/no-go targets |
| `srt_omission_error_rate` | Recorded `miss` actions / go trials |
| `srt_commission_error_rate` | `clickedRotten/falseAlarm` / no-go trials |
| `srt_extreme_fast_response_rate` | Observed RT < 150 ms / observed RT |
| `srt_extreme_slow_response_rate` | Observed RT > 2000 ms / observed RT |
| `srt_false_click_rate` | Trials with false-click marker / trials |
| `srt_assisted_trial_rate` | Trials with prompt/assistance marker / trials |

Extreme rates are technical behavioral flags, not normative classifications.

### Sound-Symbol Game implementation (`SSG`)

The current implementation records auditory cat/dog cues, expected animal, selected animal, left/right position, anticipation, and audio fallback. It does not contain comparable traditional congruent versus incongruent probe conditions—all current records may be marked incongruent—so an attentional-bias score is not computed.

| Feature | Definition |
|---|---|
| `ssg_cat_sound_accuracy` / `ssg_dog_sound_accuracy` | Accuracy by recorded sound cue |
| `ssg_left_response_accuracy` / `ssg_right_response_accuracy` | Accuracy by selected position |
| `ssg_anticipation_rate` | Anticipation markers/errors / trials |
| `ssg_same_animal_error_rate` | Recorded same-animal errors / trials |
| `ssg_audio_fallback_rate` | Audio playback failure/fallback trials / trials |
| `ssg_attentional_bias_available` | Always false in `features_v1` |
| `ssg_attentional_bias_unavailable_reason` | Machine-readable explanatory text |

### Linking Balloons (`LB`)

| Feature | Definition |
|---|---|
| `lb_completion_rate` | Unique correctly completed recorded steps / unique expected recorded steps |
| `lb_sequence_error_rate` | Sequence/number/color/rule-switch errors / attempts |
| `lb_switch_accuracy` / `lb_non_switch_accuracy` | Accuracy by observed switch marker |
| `lb_hint_trial_rate` | Hint-marked attempts / attempts |
| `lb_path_total_time_ms` | Maximum recorded cumulative path time |
| `lb_accuracy_by_rule` | Count/accuracy by observed rule type |

### DCCS

| Feature | Definition |
|---|---|
| `dccs_switch_accuracy` | Accuracy for observed switch/post-switch markers |
| `dccs_non_switch_accuracy` | Accuracy for remaining trials |
| `dccs_switch_cost_ms` | Mean correct switch RT − mean correct non-switch RT |
| `dccs_perseverative_error_rate` | Old-rule/perseverative markers / trials |
| `dccs_interference_accuracy` | Accuracy for recorded interference trials |
| `dccs_accuracy_by_rule_stage` | Count/accuracy for observed color/type/bag-color/dual-rule stages |

## Dataset architectures

### Task-level feature dataset

One row per `participant_id × session_id × task_session_id`, produced by `buildTaskLevelFeatureDataset`. It includes identifiers, version lineage, quality fields, all general features, and only the matching task-specific feature family.

### Participant cross-task dataset

One row per anonymous `participant_id × session_id`, produced by `buildParticipantCrossTaskDataset`:

```text
participant_id
session_id
feature_version
included_task_codes
corsi_*
picture_memory_*
srt_*
ssg_*
linking_balloons_*
dccs_*
overall_*
```

`overall_mean_task_accuracy` and `overall_mean_task_rt_ms` are unweighted means across available task rows. The dataset records `included_task_codes/count`; missing tasks are not imputed.

