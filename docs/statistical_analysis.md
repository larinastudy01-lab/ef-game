# Behavioral Statistical Analysis — `statistics_v1`

Input unit: Phase 2 task-level feature row (`participant_id × task_session_id × session_id`).  
Scope: descriptive statistics, distributions, correlations, longitudinal differences, authorized group-comparison utilities, multiple-comparison correction, and CSV export.

> All generated interpretation is limited to **association**, **difference**, and **pattern**. Observational data do not establish that one variable causes, improves, or leads to another.

## Architecture

```text
src/analytics/statistics/
├─ version.js                 # statistics_v1 and inferential sample gate
├─ descriptive.js             # N/mean/median/SD/IQR/min/max by task
├─ distributions.js           # histogram, box plot, missing/outlier summary
├─ correlations.js            # Pearson/Spearman selection and matrices
├─ inferenceMath.js           # tested distribution functions
├─ groupComparisons.js        # authorized real-group comparisons
├─ multipleComparison.js      # Benjamini-Hochberg FDR
├─ longitudinal.js            # assessment sequence changes/readiness
├─ analysisPipeline.js        # reproducible orchestration
├─ reports.js                 # four CSV exports
└─ __tests__/
```

The professional route `/research-statistics` loads only RLS-authorized canonical Phase 1 trials, rebuilds `features_v1`, and then runs `statistics_v1`. It does not read participant names or create demographic/diagnostic groups.

## Descriptive statistics

For Accuracy, Mean RT, RT variability, Error Rate, and every numeric task-specific feature observed for that task:

| Output | Formula |
|---|---|
| `N` | Count of non-missing numeric feature values |
| Mean | `Σx / N` |
| Median | Middle ordered value, or mean of two middle values |
| SD | Sample SD, denominator `N-1`; one value returns 0 |
| IQR | `Q3-Q1`, linearly interpolated quartiles |
| Min/Max | Observed extrema, never winsorized automatically |

Missing values remain missing and are reported as count/rate.

## Distribution analysis

- Histogram uses Freedman–Diaconis width `2×IQR/n^(1/3)`, capped at 50 bins. When IQR is zero, `ceil(sqrt(n))` is used.
- Box plot reports min, Q1, median, Q3, max.
- Outliers use transparent Tukey fences: below `Q1−1.5×IQR` or above `Q3+1.5×IQR`.
- Outliers are summarized but not deleted.
- Skewness and a distribution-shape summary are reported without claiming a normal distribution.

## Correlation method selection

`auto` selects Pearson only when both variables have at least 10 paired observations, absolute sample skewness below 1, and Tukey-outlier rate no greater than 5%. Otherwise Spearman is selected.

Every result includes:

- method and explicit reason;
- paired N;
- coefficient;
- correlation t-approximation p-value when estimable;
- Benjamini–Hochberg adjusted p-value;
- non-causal interpretation guardrail.

Feature correlations use paired complete observations. Task-to-task correlations require the same anonymous participant **and the same shared session**. Missing cross-task pairs are not manufactured from unrelated dates.

## Longitudinal comparison

Only rows explicitly marked `assessment` are used. For each participant and task, assessments are sorted by session start time and adjacent observations produce:

```text
Accuracy change       = current − previous
RT change             = current − previous
RT variability change = current − previous
Error-rate change     = current − previous
Elapsed days
```

With fewer than five paired participants, only descriptive changes are returned. `statistics_v1` also reports repeated-measures readiness: at least five participant-task units with three assessments are required before a model is even considered. Readiness is not automatic authorization to run a significance test; protocol comparability, missingness, and a prespecified analysis plan remain required.

## Group comparison support

The utility accepts only explicit arrays formed from real, study-authorized variables. It does not derive age, sex, disease, or risk groups.

| Design | Normality explicitly supported | Normality not assumed |
|---|---|---|
| Two independent groups | Welch t-test | Mann–Whitney U |
| Two paired measurements | Paired t-test | Wilcoxon signed-rank |
| Three or more groups | One-way ANOVA | Kruskal–Wallis |

Rules:

- At least five observations per group.
- Paired arrays must be participant-aligned and equally sized.
- Parametric methods require explicit `distributionAssumption: "approximately_normal"`; they are never chosen silently.
- Two-group results include deterministic percentile-bootstrap 95% CI with recorded seed/iterations.
- Effect sizes: Cohen d, Cohen dz, rank-biserial, matched-pairs rank-biserial, eta squared, or epsilon squared.
- Omnibus effect-size CI is intentionally not estimated in `statistics_v1`; the missing CI and reason are explicit rather than fabricated.

## Multiple comparisons

Benjamini–Hochberg FDR is applied to families with more than one estimable p-value. Raw and adjusted p-values are both retained. FDR control does not make an observational association causal.

## Research exports

The dashboard exports UTF-8 CSV files:

- `statistics_summary.csv`
- `correlations.csv`
- `task_statistics.csv`
- `longitudinal_statistics.csv`

Exports use anonymous `research_participants.id`; no patient name or identity bridge is included.

## Known limitations

- Current task pages generally create single-task sessions; task-to-task correlations require future/shared multi-task session IDs or an explicitly prespecified alignment rule.
- Small samples yield descriptive output rather than forced significance tests.
- Mann–Whitney and Wilcoxon p-values use documented normal approximations; tied/small distributions require specialist review.
- Statistical output is a research prototype and requires review against the study protocol before publication.

