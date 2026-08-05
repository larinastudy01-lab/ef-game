# Longitudinal Behavioral Modeling — `longitudinal_v1`

## Unit and scope

The module analyzes repeated canonical task-feature rows for the same anonymous participant. It combines Phase 1 assessment/training sessions, Phase 2 task features and Phase 6 recommendation logs. It does not compare a participant with a “normal child” reference because no validated normative dataset exists.

## Participant timeline

`buildParticipantTimeline` creates dated events for:

- Assessment session
- Training session
- Task start/session
- Task result
- Recommendation decision

Events retain anonymous participant/session/task/recommendation identifiers and are ordered by recorded timestamps. Recommendation history is optional; missing migration/access is disclosed without manufacturing events.

## Longitudinal features

For Accuracy, Mean RT, RT variability and every observed numeric task-specific feature:

```text
baseline value  = first valid time-ordered value for that task and metric
latest value    = last valid time-ordered value
absolute change = latest - baseline
relative change = (latest - baseline) / abs(baseline)
trend slope     = ordinary least-squares slope over ordered session index
```

Relative change is null when baseline is zero. Trend slope is withheld with fewer than three valid observations. No missing session is invented or interpolated.

Counts include unique overall, assessment and training sessions; task summaries also report task session count and training count. Training frequency per 30 days is available only when at least two dated training observations define a non-zero interval.

## Rolling features

Default window is three ordered task sessions. Each point can contain:

- rolling mean;
- rolling median;
- rolling sample SD (“rolling variability”).

All rolling values remain null until the participant-task series has at least three total sessions and the current point contains a complete three-session window. `rolling_reliable` and `rolling_reliability_reason` are retained with every row. The rolling summary is descriptive and does not diagnose fatigue, learning or decline.

## Six task series

The pipeline always provides keys for CBT/Corsi, PM/Picture Memory, SRT, SSG, LB/Linking Balloons and DCCS. Missing tasks return empty arrays. Task-specific trend metrics are discovered only from actual numeric `cbt_*`, `pm_*`, `srt_*`, `ssg_*`, `lb_*` and `dccs_*` feature fields; no unrecorded condition is created.

## Personal-baseline comparison

The dashboard compares current/latest values only with the participant’s own first valid observation for the same task and metric. Different tasks are not treated as interchangeable scales. “Positive” or “negative” change is not automatically called improvement or deterioration because speed/accuracy tradeoffs, difficulty, practice, interruptions and session context may contribute.

## Mixed-effects architecture

Readiness requires at least 20 participants with three or more comparable repeated participant-task observations. The planned interface is:

```text
outcome ~ session_time + session_type + difficulty + (1 | participant_id)
```

`model_fitted` remains false in `longitudinal_v1`, even if the row-count threshold is reached. A future implementation still requires a prespecified protocol, comparability/missingness audit, suitable server-side statistics library and research review. The dashboard does not report coefficients, p-values or a claimed mixed-effects result.

## Professional dashboard

Route `/longitudinal-dashboard` displays overall timeline, six task selectors, Accuracy/RT/RT-variability series, reliable rolling means, task-specific baseline/latest/change/slope, training history, recommendation history and mixed-effects readiness.

Interpretation guardrail: changes and slopes are within-participant behavioral patterns. They do not establish causation, diagnosis, normative status, or training effectiveness.

