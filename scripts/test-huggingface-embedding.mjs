import { pipeline, env } from "@huggingface/transformers";

env.cacheDir = "./.cache/huggingface";

const extractor = await pipeline(
  "feature-extraction",
  "Xenova/multilingual-e5-small"
);

const output = await extractor(
  "query: 兒童認知彈性與規則切換",
  {
    pooling: "mean",
    normalize: true,
  }
);

const embedding = Array.from(output.data);

console.log("Embedding 維度：", embedding.length);
console.log("前 5 個值：", embedding.slice(0, 5));