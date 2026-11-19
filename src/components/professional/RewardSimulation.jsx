import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { createSimulationPolicies } from "../../analytics/recommendation/simulation";
import { prepareRewardPresentation } from "../../utils/rewardPresentation";
import { formatNumber } from "../../utils/professionalFormatters";
import { ChartContainer, ResearchDataTable, ResearchNotice } from "../research/ResearchStudioUI";

const COLORS = ["#163B59", "#5579A3", "#387D68", "#98640C", "#9C5570", "#677B8C"];
export function RewardSimulation({ simulation, seed, rounds }) {
  const prepared = useMemo(() => prepareRewardPresentation(simulation), [simulation]);
  const [selected, setSelected] = useState(["UCB1"]);
  const [range, setRange] = useState([1, rounds]);
  const visible = prepared.rounds.filter((row) => row.round >= range[0] && row.round <= range[1]);
  const parameters = useMemo(() => createSimulationPolicies(seed).map((p, index) => ({ policy: p.name, version: p.version,
    parameters: Object.fromEntries(["alpha", "epsilon", "exploration"].filter((key) => p[key] !== undefined).map((key) => [key, p[key]])), environmentSeed: seed + index })), [seed]);
  return <>
    <section className="studio-card"><h2>策略摘要・模擬</h2><ResearchDataTable title="策略摘要" rows={prepared.policies} getKey={(p) => p.key} searchable={false} columns={[
      { key: "policy", label: "策略" }, ...[["mean", "平均 Reward"], ["cumulative", "累積 Reward"], ["sd", "Reward 標準差"]].map(([key, label]) => ({ key, label, numeric: true, render: (p) => formatNumber(p[key], 3, "failed") })),
      { key: "rounds", label: "模擬回合", numeric: true, render: (p) => `${p.validCount}／${p.rounds}` },
    ]}/><p className="research-caption">摘要使用全 {rounds} 回合；標準差為樣本標準差（分母 n−1），不是策略差異的推論檢定。</p></section>
    <ChartContainer title="回合回饋趨勢" count={visible.length} countLabel="回合" unit="原始 Reward（0–1）" source="固定種子的策略模擬">
      <fieldset className="professional-policy-options"><legend>顯示策略</legend>{prepared.policies.map((p) => <label key={p.key}><input type="checkbox" checked={selected.includes(p.policy)} onChange={(e) => setSelected((current) => e.target.checked ? [...current, p.policy] : current.filter((name) => name !== p.policy))}/>{p.policy}</label>)}</fieldset>
      <div className="studio-local-filters"><label>起始回合<input type="number" min="1" max={range[1]} value={range[0]} onChange={(e) => { const v = Number(e.target.value); if (Number.isInteger(v) && v >= 1 && v <= range[1]) setRange([v, range[1]]); }}/></label><label>結束回合<input type="number" min={range[0]} max={rounds} value={range[1]} onChange={(e) => { const v = Number(e.target.value); if (Number.isInteger(v) && v >= range[0] && v <= rounds) setRange([range[0], v]); }}/></label></div>
      {!selected.length ? <p>請勾選要比較的策略。</p> : <ResponsiveContainer width="100%" height={280}><LineChart data={visible} margin={{ top: 16, right: 24, bottom: 24, left: 12 }}>
        <CartesianGrid vertical={false} stroke="var(--research-border)"/><XAxis dataKey="round" type="number" domain={[range[0], range[1]]} allowDecimals={false} label={{ value: "模擬回合", position: "insideBottom", offset: -16 }}/>
        <YAxis type="number" domain={[0, 1]} ticks={[0, .25, .5, .75, 1]} allowDataOverflow tickFormatter={(v) => formatNumber(v, 2)} label={{ value: "Reward", angle: -90, position: "insideLeft" }}/>
        <Tooltip labelFormatter={(v) => `第 ${v} 回合`} formatter={(v, name) => [formatNumber(v, 4), name]} contentStyle={{ background: "var(--research-card)", color: "var(--research-ink)" }}/><Legend/>
        {prepared.policies.filter((p) => selected.includes(p.policy)).map((p) => <Line key={p.key} type="linear" dataKey={p.key} name={p.policy} stroke={COLORS[prepared.policies.indexOf(p)]} dot={visible.length <= 12} strokeWidth={2} connectNulls={false} isAnimationActive={false}/>)}
      </LineChart></ResponsiveContainer>}
      <p className="research-caption">X 軸：回合；Y 軸：既有 reward_balanced_v1。顯示原始 Reward，未平滑、補值或截斷。無效值留缺口，完整來源在下方保留。</p>
      {prepared.diagnostics.length > 0 && <ResearchNotice tone="warning"><details><summary>{prepared.diagnostics.length} 項來源檢查提示</summary><ul>{prepared.diagnostics.map((d, i) => <li key={i}>{d}</li>)}</ul></details></ResearchNotice>}
    </ChartContainer>
    <details className="studio-advanced"><summary>Reward 定義、模擬條件、參數與原始回合</summary><section className="studio-card">
      <h3>reward_balanced_v1</h3><p>Reward = 0.55 × accuracy + 0.20 × efficiency + 0.15 × stability + 0.10 × completion；既有 calculateReward 最終限制為 0–1，因此圖軸固定為 0–1。efficiency = accuracy × clamp(targetRT / max(RT, 0.25 × targetRT))；stability = 1 − clamp(RT變異 / targetRT)；completion 為 0 或 1。此處 clamp 為既有 Reward 定義，介面不另行截斷來源數值。</p>
      <p>來源：既有 runPolicySimulation / environmentOutcome；每策略 {rounds} 回合，基礎種子 {seed}，初始正確率 0.65、難度 2、RT 850 ms。六種任務使用相同環境公式與安全行動邊界，各策略環境種子為基礎種子＋既有策略索引，因此不是逐回合配對的相同噪音實驗。</p>
      <p>環境：任務基準 CBT 0.73、PM 0.68、SRT 0.70、ARI 0.62、LB 0.66、DCCS 0.64；正確率依難度差扣 0.08 並加 ±0.09 噪音，既有環境限制為 0.05–0.98。RT = 650 + 90 × 難度 + [0,180) ms，RT 變異 = 80 + [0,170) ms，完成機率 0.96。Random 均勻抽選可用行動；Rule-based 沿用既有規則；Thompson Sampling 沿用 Beta(1,1) 初始分布。其餘建構參數及各環境種子如下；未更動演算法。</p><pre>{JSON.stringify(parameters, null, 2)}</pre>
      <ResearchDataTable title="既有策略詳細指標" rows={prepared.policies} columns={[{ key: "policy", label: "策略" }, { key: "policy_version", label: "版本" }, { key: "final_20_mean_reward", label: "最後 20 回合平均", render: (p) => formatNumber(p.final_20_mean_reward, 3) }]}/>
      <details><summary>原始逐回合紀錄（含 Reward 組成與選用行動）</summary><pre>{JSON.stringify(simulation, null, 2)}</pre></details><p>模擬策略比較 ≠ 真實幼兒訓練成效；單次種子平均回饋不代表臨床優越性。</p>
    </section></details>
  </>;
}
