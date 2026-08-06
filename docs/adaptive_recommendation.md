# Adaptive Cognitive Training Recommendation — `adaptive_recommendation_v1`

## Existing system audit and compatibility

The repository already contains task-specific rule-based difficulty recommendations. Phase 6 does not delete or replace them:

- CBT: `recommendCBTNextDifficulty` considers accuracy, early/location/order errors, timeout, replay/rescue, idle hints, late-session drop and performance score. It can maintain, change support, or move difficulty.
- SRT: `recommendNextSrtDifficulty` requires minimum trial/RT counts, then considers accuracy, independent accuracy, misses, no-go errors, background clicks, assistance, RT CV and late-session change before moving one step.
- DCCS and SSG analyzers similarly retain their task-specific recommendation outputs.
- `GameMenuPage.getRecommendedTrainingPlan` continues to consume the existing `trainingLevelPlan`/`dailyTrainingPlan`. If absent, it retains the existing rotating stage plan.

The new `RuleBasedPolicy` is a common research comparator, not a silent replacement for those analyzers. It prioritizes tasks using:

```text
priority = (1 - recent_accuracy)
         + 0.25 × bounded_rt_variability
         - 0.15 × recent_performance_change
         - 0.01 × recent_training_count
```

For the selected task, accuracy ≥ .85 proposes one level higher, accuracy < .60 proposes one lower, otherwise it maintains. The allowed-action boundary is applied before this rule.

## Arms and action boundary

Bandit arm v1 is one of the six existing tasks: CBT, PM, SRT, SSG, LB or DCCS. The selected action also contains a difficulty level, but task × difficulty is not yet modeled as an independent statistical arm.

Safety boundary:

- Known current difficulty: only the same level or ±1 level is available.
- Unknown current difficulty: only levels 1–2 are available.
- Only explicitly allowed tasks enter the action set.
- Every selected action is checked against the filtered set; violation throws rather than silently proceeding.

This boundary is a software safeguard, not evidence of clinical safety. A future protocol may further narrow actions but must not silently widen the boundary.

## Policies

### Random — `random_v1`

Uniform seeded choice among allowed actions. Experimental baseline only.

### Rule-based — `rule_based_v1`

The documented common comparator above. Existing task-specific rules remain available separately.

### ε-Greedy — `epsilon_greedy_v1`

With probability ε, chooses a random allowed task arm; otherwise selects the arm with the largest incremental mean reward. Default ε=.10. Difficulty is chosen only from allowed actions.

### UCB1 — `ucb1_v1`

Tries each available task arm once, then selects:

```text
mean_reward_arm + sqrt(2 × ln(total_selections) / arm_selections)
```

### Thompson Sampling — `beta_thompson_v1`

Each task starts with Beta(1,1). A sampled value selects the arm. Bounded fractional reward updates α by reward and β by `1-reward`.

### Contextual Bandit — `linear_contextual_ucb_v1`

Diagonal LinUCB prototype. Context uses only approved behavioral fields: recent accuracy, mean RT, RT variability, recent performance change, previous task, per-task history, current difficulty and recent training count. Per-arm context includes whether it was the previous task and its recent accuracy/count. Unrecognized fields and medical/sensitive labels are removed before selection and logging.

## Reward versions

Rewards are always stored with `reward_version` and component values.

- `reward_accuracy_v1`: `accuracy`
- `reward_efficiency_v1`: `accuracy × clamp(target_rt / observed_rt)`; missing RT receives a conservative half-accuracy efficiency
- `reward_balanced_v1`: `0.55 accuracy + 0.20 efficiency + 0.15 RT stability + 0.10 completion`

All rewards are bounded to [0,1]. These are experimental behavioral objectives, not clinical benefit measures. Changing weights requires a new reward version.

## Decision logging

The additive `recommendation_decisions` migration stores recommendation ID, anonymous participant ID, timestamp, recommendation/policy/reward versions, sanitized context, available actions, selected action, predicted reward, exploration flag, actual outcome, actual reward and reward components.

Core decision fields are immutable. An outcome may be appended once and cannot be overwritten. RLS follows the Phase 1 participant relationship functions. Simulation decisions are rejected by the persistence function.

New online integrations should call `recommendAndLog` rather than `makeRecommendation` directly so the decision is stored before it is presented. After training, `recordOutcomeAndUpdatePolicy` calculates the declared reward version, appends the outcome once and updates policy state. The existing task analyzers are deliberately not rewired in this phase.

## Online training integration

`GameMenuPage` now requests a persisted UCB1 recommendation for the selected child and allowed training tasks. The recommended task and bounded difficulty replace the first stage shown on the training map. An unfinished decision is reused during the browser session so page refreshes do not create duplicate decisions.

All six training tasks already save through `saveUnifiedResult`. That shared path now converts the completed unified result into an outcome, appends the versioned reward to the active decision, and clears it only after persistence succeeds. Before each recommendation/update, UCB1 state is reconstructed from observed decision history, so learning survives reloads and devices. If Supabase or the recommendation migration is unavailable, the configured training plan remains usable and the menu displays a fallback notice.

Migration: `supabase/migrations/20260730_phase6_recommendation_decisions.sql`. Rollback drops only the decision-log table and does not change existing training results or recommendation code.

## Offline simulation

`runPolicySimulation` compares Random, Rule-based, ε-Greedy, UCB1, Thompson Sampling and Contextual Bandit in the same deterministic synthetic environment. It reports overall and final-20 mean reward.

Every row/result is labeled **Simulation — not observed child training effect**. The environment merely checks learning/update mechanics; it cannot establish policy superiority for preschool children or training effectiveness.

## Research dashboard

Professional route `/adaptive-recommendation-research` displays:

- policy simulation comparison with explicit Simulation labels;
- observed recommendation history from the decision log;
- selected policy/task/difficulty;
- predicted and actual reward;
- recorded performance change;
- exploration safety disclosure.

Observed and simulated rows are never merged.
