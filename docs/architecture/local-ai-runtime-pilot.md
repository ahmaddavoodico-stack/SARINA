# SARINA Local AI Runtime Pilot

**Status:** isolated implementation scaffold; not deployed; model dispatch remains disabled.
**Work branch:** `feature/local-ai-runtime-evaluation`
**Baseline:** `feature/farmer-portal-foundation`
**Decision scope:** select open-weight models, add a provider-neutral server-side adapter, and assess whether the current hosting can run inference.

## 1. Verified current hosting boundary

The repository's current `vercel.json` builds a Vite static site to `dist`; it does not define a persistent Node/Python inference service. The app's current hosting is therefore not a general-purpose GPU server.

The current Supabase deployment inventory identifies hosted Supabase Edge Functions. Supabase's current hosted Edge Function limits are 256 MB memory and 2 seconds of active CPU time per request. This is not enough to load or run a multi-billion-parameter model.

Vercel Functions are not configured as the model host in this repository. Even where Vercel Functions are available, their documented Hobby limit is 2 GB / 1 vCPU and their execution is request-oriented; they are not a persistent GPU inference host. The present static Vite deployment does not create such a service.

**Finding:** local model inference cannot be meaningfully hosted on the current SARINA production hosting. We can add and test the adapter contract in the repository, but an actual model process needs a separate persistent compute host or a future consolidated server. Do not attempt to download model weights into Vercel build output or Supabase Edge Function bundles.

## 2. Model selection

The first pilot should favor a small, multilingual, multimodal open-weight model with a permissive published license and a quantized package that can fit a modest GPU.

### Primary pilot model: Qwen3.5 4B

- Runtime package: Ollama model tag `qwen3.5:4b`.
- Approximate quantized download shown by Ollama: 3.3–4.0 GB.
- Modalities: text and image input.
- Published model license: Apache 2.0.
- Intended first tasks: friendly routine conversation, general low-risk explanations, classification, extraction, summarization and drafting.
- Vision support must be tested on actual farm photographs; its existence does not establish agricultural diagnostic reliability.

### Upgrade candidate: Qwen3.5 9B

- Runtime package: Ollama model tag `qwen3.5:9b`.
- Approximate quantized download shown by Ollama: 6.6–7.6 GB.
- Modalities: text and image input.
- Published model license: Apache 2.0.
- Evaluate only after the 4B model baseline; it needs more memory and may reduce concurrency on a modest host.

The exact model artifact, quantization, runtime version and license file must be pinned and recorded before a production deployment. Model weights are not copied into Git.

### Strata runtime

Strata is an MIT-licensed local inference runtime, not a model. Model weights and their licenses remain separate. Keep Strata as an evaluation candidate because it was previously selected for a separate pilot, but do not assume every model supported by Ollama is supported by Strata. Verify the exact Strata release, supported model family, hardware pack, API behavior and model license before choosing it.

The Strata README currently highlights Qwen3.8-Flash-Next and Qwen3.6-35B-A3B. Qwen3.8-Flash-Next is a very large experimental model family with separate Qwen Community terms; it is not the first budget-constrained production choice. Do not describe Strata's MIT software license as the license for the model weights.

## 3. Runtime and integration decision

- Use an OpenAI-compatible HTTP adapter so SARINA can connect to Ollama, Strata or another approved self-hosted runtime without changing farmer-facing UI.
- The new `_shared/local-model-adapter.ts` module is server-side only and is disabled unless `SARINA_LOCAL_AI_ENABLED=true`.
- Model IDs are selected only from the server-side allowlist. Farmer or specialist input cannot select an endpoint, runtime, model or provider.
- The adapter currently supports bounded text messages and non-streaming chat completions. Image payload support, structured-output enforcement, task routing, audit persistence and production dispatch are not implemented by this scaffold.
- The adapter is not imported by the live `sarina-central-intelligence` handler. No live route is changed by this commit.
- SCI remains responsible for consent, data scope, task risk and final decisions. The local model is not an agricultural authority and must not issue final diagnoses, pesticide/fertilizer rates, irrigation commands or physical actions.

## 4. Data and routing policy

Local model pilot may be evaluated for low-sensitivity tasks only:
- greetings and everyday conversation;
- basic explanations that do not carry high agronomic consequence;
- classification, extraction, translation, summarization and draft preparation;
- preliminary image description only after a separate vision test.

Escalate to the single approved external API only when SCI policy identifies a complex, ambiguous, specialized or high-consequence case, or when the local model is unavailable or below the measured quality threshold. Do not send official circular lookups to a paid model by default; retrieve verified institutional sources first.

Use synthetic or de-identified test records until data protection, consent, region and provider terms have been reviewed. Preserve the distinction between farmer reports, verified measurements, retrieved sources and model estimates. Specialist review remains required for consequential agricultural advice.

## 5. Existing external API budget

The project record retains the previously approved one-time USD 5 technical API test ceiling, with automatic recharge disabled and usage inspected after each stage. No production API spending is approved by this pilot.

A ChatGPT consumer subscription does not include OpenAI API usage; API billing and credentials are separate. Keep one external API provider only, and do not activate it until the server-side secret, explicit model allowlist and hard spending guard are verified.

## 6. Hardware acceptance gates for the future consolidated host

Do not buy hardware from model marketing claims alone. Obtain a written specification and run a benchmark with the exact model artifact.

Initial evaluation target for Qwen3.5 4B:
- 32 GB system RAM preferred for the combined app/runtime/database-agent workload;
- NVIDIA GPU with 8–12 GB VRAM preferred for responsive inference, subject to measured quantization and context size;
- at least 100 GB free NVMe for model artifacts, logs and safe update headroom;
- Ubuntu Server LTS, root access, CUDA support if NVIDIA is selected;
- HTTPS/private network path, firewall, monitoring, backup and restart policy.

For Qwen3.5 9B, plan a higher memory tier (preferably 16 GB VRAM) and verify concurrent-request behavior before adopting it.

These are procurement targets, not guarantees of throughput. Benchmark time-to-first-token, tokens/second, peak RAM/VRAM, 1/3/5 concurrent requests, cold start, 24-hour stability and Persian/Arabic quality. Keep inference resource limits separate from the web app process.

## 7. Existing resilience requirement to reconcile

A previous SARINA decision called for two geographically separate local-AI systems, with the second as standby failover because of power outages. The current consolidation direction proposes one primary, powerful SARINA host. For the first controlled pilot, use one primary host; before production procurement, explicitly decide whether the geographically separate standby remains a required continuity control. Do not silently mark that earlier resilience requirement as cancelled.

## 8. Acceptance checklist

- [ ] Confirm the current Vercel deployment type and actual plan/limits in the account.
- [x] Inspect repository deployment configuration: static Vite build to `dist`.
- [x] Inspect Supabase function inventory snapshot and current documented Edge limits.
- [x] Add a disabled, server-only OpenAI-compatible local adapter scaffold.
- [x] Add isolated Deno contract tests and include the adapter in the SCI type-check workflow; tests have not yet been executed.
- [ ] Run TypeScript/Deno checks for the adapter in the project's actual CI/runtime; branch checks were not triggered because the repository workflow currently runs on PR/push to main.
- [ ] Obtain actual current host resource inventory; no SSH/host telemetry is available from this repository inspection.
- [ ] Confirm exact Strata release and model compatibility; do not assume Qwen3.5 support.
- [ ] Benchmark Qwen3.5 4B on a persistent test host using synthetic Persian/Arabic agricultural prompts.
- [ ] Benchmark Qwen3.5 9B only if the first model's quality is insufficient and resources permit.
- [ ] Validate image support separately with controlled farm images and specialist adjudication.
- [ ] Add provider routing, schema validation, audit/usage records, consent and hard limits.
- [ ] Keep production dispatch disabled until security, quality, reliability and owner acceptance gates pass.

## 9. References

- Qwen3.5 4B model card and license: https://huggingface.co/Qwen/Qwen3.5-4B
- Qwen3.5 9B model card and license: https://huggingface.co/Qwen/Qwen3.5-9B
- Ollama Qwen3.5 library: https://ollama.com/library/qwen3.5
- Ollama Linux installation and API documentation: https://ollama.com/download/linux and https://docs.ollama.com/api/openai-compatibility
- Strata project: https://github.com/Niko1221/Strata
- Vercel Function limits: https://vercel.com/docs/functions/limitations
- Supabase Edge Function limits: https://supabase.com/docs/guides/functions/limits
