/**
 * Tasker - Work Profile Inference
 *
 * Reads the tools someone actually spends time in and reports which kind of
 * work that pattern resembles. It is an inference about a browsing pattern,
 * never a claim about a person.
 *
 * Three rules govern everything below, and they are the reason this file is
 * as conservative as it is:
 *
 *   1. Evidence or silence. Below the thresholds in REQUIREMENTS the answer is
 *      "not enough evidence yet", with the specific shortfall named. There is
 *      no default guess, no "probably a developer" because the extension was
 *      installed from a dev blog.
 *
 *   2. Every claim is auditable. The result carries the exact signals that
 *      produced it - tool, hours, days seen - so the user can check the
 *      reasoning rather than take it on faith.
 *
 *   3. A close call is reported as a close call. When the leader does not
 *      clearly separate from the runner-up, the status is 'ambiguous' and the
 *      candidates are listed side by side instead of one being promoted.
 *
 * The user's own answer always wins: settings.workProfile.override replaces
 * the inference entirely, and is reported as stated rather than detected.
 *
 * Privacy: this runs entirely on the device against data already stored
 * locally. Nothing here is sent anywhere, and the inferred role is never
 * included in the payload to the summary service.
 */

const RoleDetector = {

  /* ---------------------------------------------------------------------
     Roles
     ---------------------------------------------------------------------
     The catalogue is deliberately wide, including the job titles that only
     became common around 2024-2026. A narrow catalogue does not make
     detection more accurate - it makes it confidently wrong, because every
     unlisted job is forced into the nearest listed one.

     `aliases` is the other half of that. The AI job market in 2026 runs the
     same work under a dozen names - AI Engineer, Applied AI Engineer, GenAI
     Engineer, LLM Engineer, Prompt Engineer, AI-Native Developer - and the
     pay varies by title far more than the work does. Browsing evidence cannot
     tell those apart, because they are the same tools in the same tabs.

     So they are ONE role carrying every name it is advertised under, rather
     than a dozen roles competing over the same evidence. Splitting them would
     do two bad things at once: guarantee a permanent 'too close to call' for
     anyone doing AI work, and let a coin-flip between two labels decide which
     job title Tasker printed next to someone's name.

     A separate role exists only where the tooling genuinely separates - a
     retrieval specialist lives in vector databases, an evaluation engineer in
     eval harnesses, a red teamer in attack tooling. Those are distinguishable.
     "LLM Engineer versus AI Engineer" is not.
     ------------------------------------------------------------------- */
  ROLES: {
    ai_engineer: {
      label: 'AI / LLM Engineer', family: 'AI', icon: 'smart_toy',
      aliases: ['Applied AI Engineer', 'Generative AI Engineer', 'GenAI Engineer',
                'AI Software Engineer', 'LLM Engineer', 'Prompt Engineer',
                'Context Engineer', 'AI-Native Developer', 'AI-Augmented Engineer']
    },
    agent_ops: {
      label: 'Agent / Agentic AI Engineer', family: 'AI', icon: 'hub',
      aliases: ['Agent Engineer', 'Agentic AI Engineer', 'Agent Ops',
                'AI Automation Engineer', 'AI Workflow Engineer']
    },
    rag_engineer: {
      label: 'RAG / Retrieval Engineer', family: 'AI', icon: 'manage_search',
      aliases: ['Retrieval Engineer', 'Search & Retrieval Engineer',
                'Context Engineer', 'Knowledge Systems Engineer']
    },
    evals_engineer: {
      label: 'AI Evaluation Engineer', family: 'AI', icon: 'checklist',
      aliases: ['Evals Engineer', 'AI Evaluator', 'Model Behavior Engineer',
                'AI Quality Engineer']
    },
    ai_red_team: {
      label: 'AI Red Teamer', family: 'AI', icon: 'shield_lock',
      aliases: ['AI Security Engineer', 'Model Security Researcher',
                'Adversarial ML Engineer']
    },
    ai_safety: {
      label: 'AI Safety & Alignment', family: 'AI', icon: 'verified',
      aliases: ['AI Alignment Engineer', 'AI Safety Engineer',
                'Responsible AI Engineer']
    },
    ml_engineer: {
      label: 'Machine Learning Engineer', family: 'AI', icon: 'model_training',
      aliases: ['ML Engineer', 'Deep Learning Engineer', 'AI Trainer (modelling)']
    },
    ai_research: {
      label: 'AI Research Engineer', family: 'AI', icon: 'science',
      aliases: ['Research Engineer', 'Research Scientist', 'ML Research Engineer',
                'Member of Technical Staff']
    },
    mlops: {
      label: 'MLOps / AI Platform Engineer', family: 'AI', icon: 'deployed_code',
      aliases: ['LLMOps Engineer', 'AI Infrastructure Engineer', 'AI Platform Engineer',
                'AI Reliability Engineer', 'AIOps Engineer', 'Model Deployment Engineer']
    },
    forward_deployed: {
      label: 'Forward-Deployed AI Engineer', family: 'AI', icon: 'network_node',
      aliases: ['AI Solutions Architect', 'AI Solutions Engineer',
                'Deployment Strategist', 'Field AI Engineer']
    },
    ai_leader: {
      label: 'Head of AI / AI Strategy', family: 'AI', icon: 'workspace_premium',
      aliases: ['Chief AI Officer', 'AI Strategist', 'AI Transformation Lead',
                'VP of AI']
    },
    ai_trainer: {
      label: 'AI Trainer / Data Annotation', family: 'AI', icon: 'dataset',
      aliases: ['AI Tutor', 'Data Annotation Specialist', 'RLHF Contributor',
                'Human Data Specialist']
    },
    data_scientist:     { label: 'Data Scientist',               family: 'Data',        icon: 'query_stats' },
    data_engineer:      { label: 'Data Engineer',                family: 'Data',        icon: 'database' },
    analytics_engineer: { label: 'Analytics Engineer',           family: 'Data',        icon: 'insights' },
    data_analyst:       { label: 'Data / BI Analyst',            family: 'Data',        icon: 'bar_chart' },

    frontend:           { label: 'Frontend Engineer',            family: 'Engineering', icon: 'code' },
    backend:            { label: 'Backend Engineer',             family: 'Engineering', icon: 'api' },
    fullstack:          { label: 'Full-stack Engineer',          family: 'Engineering', icon: 'terminal' },
    mobile:             { label: 'Mobile Engineer',              family: 'Engineering', icon: 'deployed_code' },
    devops:             { label: 'DevOps / Platform / SRE',      family: 'Engineering', icon: 'engineering' },
    security:           { label: 'Security Engineer',            family: 'Engineering', icon: 'shield' },
    soc_analyst:        { label: 'Security / SOC Analyst',       family: 'Engineering', icon: 'monitoring' },
    qa:                 { label: 'QA / Test Automation',         family: 'Engineering', icon: 'checklist' },
    game_dev:           { label: 'Game Developer',               family: 'Engineering', icon: 'movie' },
    web3:               { label: 'Web3 / Blockchain Engineer',   family: 'Engineering', icon: 'hub' },
    embedded:           { label: 'Embedded / Robotics Engineer', family: 'Engineering', icon: 'handyman' },
    solutions_arch:     { label: 'Solutions Architect / SE',     family: 'Engineering', icon: 'network_node' },

    product_manager:    { label: 'Product Manager',              family: 'Product',     icon: 'flag' },
    ai_pm: {
      label: 'AI Product Manager', family: 'Product', icon: 'auto_awesome',
      aliases: ['GenAI Product Manager', 'AI PM', 'Product Manager, AI Platform']
    },
    product_designer:   { label: 'Product Designer',             family: 'Design',      icon: 'design_services' },
    design_engineer:    { label: 'Design Engineer',              family: 'Design',      icon: 'brush' },
    ux_researcher:      { label: 'UX Researcher',                family: 'Design',      icon: 'person_search' },
    brand_designer:     { label: 'Brand / Visual Designer',      family: 'Design',      icon: 'palette' },
    content_creator:    { label: 'Video / Content Creator',      family: 'Design',      icon: 'movie' },

    growth_marketer:    { label: 'Growth / Performance Marketer',family: 'Go-to-market',icon: 'campaign' },
    seo_content:        { label: 'Content & SEO Strategist',     family: 'Go-to-market',icon: 'manage_search' },
    sales_ae:           { label: 'Sales / Account Executive',    family: 'Go-to-market',icon: 'sell' },
    revops:             { label: 'RevOps / Sales Operations',    family: 'Go-to-market',icon: 'monitoring' },
    customer_success:   { label: 'Customer Success Manager',     family: 'Go-to-market',icon: 'support_agent' },
    support_engineer:   { label: 'Support Engineer',             family: 'Go-to-market',icon: 'support_agent' },
    community:          { label: 'Community Manager',            family: 'Go-to-market',icon: 'groups' },
    dev_advocate:       { label: 'Developer Advocate',           family: 'Go-to-market',icon: 'record_voice_over' },

    recruiter:          { label: 'Recruiter / Talent',           family: 'Operations',  icon: 'person_search' },
    people_ops:         { label: 'HR / People Operations',       family: 'Operations',  icon: 'badge' },
    finance:            { label: 'Finance / Accounting',         family: 'Operations',  icon: 'payments' },
    legal:              { label: 'Legal / Compliance',           family: 'Operations',  icon: 'gavel' },
    project_manager:    { label: 'Project / Delivery Manager',   family: 'Operations',  icon: 'today' },
    founder:            { label: 'Founder / Operator',           family: 'Operations',  icon: 'rocket_launch' },

    technical_writer:   { label: 'Technical Writer',             family: 'Content',     icon: 'article' },
    academic:           { label: 'Academic Researcher',          family: 'Research',    icon: 'school' },
    educator:           { label: 'Educator / Instructor',        family: 'Research',    icon: 'menu_book' },
    bioinformatics:     { label: 'Bioinformatics / Comp Bio',    family: 'Research',    icon: 'biotech' },
    clinician:          { label: 'Healthcare Professional',      family: 'Research',    icon: 'stethoscope' },
    student:            { label: 'Student / Learner',            family: 'Research',    icon: 'school' }
  },

  /* ---------------------------------------------------------------------
     Signals
     ---------------------------------------------------------------------
     One signal is one recognisable tool or behaviour. `domains` are matched
     as suffix-or-substring against the hostname; `actions` match the verb
     describeActivity() already assigned, which is how "reviewed a pull
     request" can count for more than "opened github.com".

     Weights within a signal are a distribution of what that tool implies,
     not a ranking of importance. A tool used by five roles spreads its
     weight across five roles and therefore separates nothing on its own -
     which is the correct behaviour, and the reason a single signal can
     never produce an answer.
     ------------------------------------------------------------------- */
  SIGNALS: [
    // --- AI / LLM ------------------------------------------------------
    // The generalist signals below deliberately keep most of their weight on
    // ai_engineer. The specialisms are separated by the tools only they use -
    // vector stores, eval harnesses, attack tooling - so a specialist is
    // identified by what is distinctive about their week, not by splitting the
    // shared foundation four ways and leaving nobody with a majority.
    { id: 'llm_api', label: 'LLM provider consoles', domains: ['platform.openai.com', 'console.anthropic.com', 'ai.google.dev', 'aistudio.google.com', 'console.mistral.ai', 'console.groq.com', 'bedrock', 'openrouter.ai', 'api.together.xyz', 'cohere.com', 'deepseek.com', 'x.ai'], roles: { ai_engineer: 0.46, agent_ops: 0.16, rag_engineer: 0.1, ml_engineer: 0.1, ai_pm: 0.08, forward_deployed: 0.06, ai_leader: 0.04 } },
    { id: 'agent_frameworks', label: 'Agent & orchestration frameworks', domains: ['langgraph', 'crewai', 'autogen', 'modelcontextprotocol.io', 'composio', 'e2b.dev', 'browser-use', 'n8n.io', 'make.com', 'zapier.com'], roles: { agent_ops: 0.58, ai_engineer: 0.18, forward_deployed: 0.07, founder: 0.07, growth_marketer: 0.1 } },
    { id: 'llm_frameworks', label: 'LLM application frameworks', domains: ['langchain.com', 'llamaindex.ai', 'haystack.deepset', 'semantic-kernel', 'dspy'], roles: { ai_engineer: 0.34, rag_engineer: 0.34, agent_ops: 0.24, forward_deployed: 0.08 } },
    { id: 'vector_store', label: 'Vector stores & retrieval', domains: ['pinecone.io', 'weaviate.io', 'qdrant.tech', 'trychroma.com', 'milvus.io', 'pgvector', 'turbopuffer', 'vespa.ai', 'marqo.ai', 'lancedb'], roles: { rag_engineer: 0.62, ai_engineer: 0.14, data_engineer: 0.12, mlops: 0.06, agent_ops: 0.06 } },
    { id: 'llm_tracing', label: 'LLM tracing & observability', domains: ['smith.langchain.com', 'langfuse', 'helicone', 'promptlayer', 'arize.com', 'phoenix.arize', 'logfire'], roles: { evals_engineer: 0.36, ai_engineer: 0.24, mlops: 0.22, agent_ops: 0.18 } },
    { id: 'llm_evals', label: 'Evaluation harnesses & scoring', domains: ['braintrust', 'promptfoo', 'ragas.io', 'inspect.ai', 'patronus', 'galileo.ai', 'humanloop', 'lm-evaluation-harness', 'confident-ai'], roles: { evals_engineer: 0.5, ai_safety: 0.18, ai_engineer: 0.16, ml_engineer: 0.1, qa: 0.06 } },
    { id: 'ai_red_team_tools', label: 'Adversarial & model-security tooling', domains: ['garak', 'pyrit', 'lakera.ai', 'hiddenlayer', 'protectai', 'robustintelligence', 'promptarmor', 'adversarial-robustness'], roles: { ai_red_team: 0.56, ai_safety: 0.2, security: 0.16, evals_engineer: 0.08 } },
    { id: 'model_hub', label: 'Model hubs & weights', domains: ['huggingface.co', 'replicate.com', 'together.ai', 'fireworks.ai', 'ollama', 'lmstudio.ai'], roles: { ai_engineer: 0.3, ml_engineer: 0.26, ai_research: 0.18, mlops: 0.16, data_scientist: 0.1 } },
    { id: 'inference_hosting', label: 'Inference hosting & GPU runtimes', domains: ['modal.com', 'baseten.co', 'vllm.ai', 'runpod.io', 'lambdalabs', 'coreweave', 'anyscale'], roles: { mlops: 0.46, ml_engineer: 0.24, ai_engineer: 0.2, ai_research: 0.1 } },
    { id: 'ml_training', label: 'Training frameworks & experiments', domains: ['pytorch.org', 'tensorflow.org', 'wandb.ai', 'comet.com', 'neptune.ai', 'lightning.ai', 'nvidia.com', 'jax.readthedocs'], roles: { ml_engineer: 0.36, ai_research: 0.32, data_scientist: 0.16, mlops: 0.1, academic: 0.06 } },
    { id: 'ml_platform', label: 'Model serving, registries & deployment', domains: ['mlflow', 'kubeflow', 'bentoml', 'seldon', 'sagemaker', 'vertex-ai', 'ray.io', 'zenml', 'metaflow'], roles: { mlops: 0.58, ml_engineer: 0.22, data_engineer: 0.1, ai_engineer: 0.1 } },
    { id: 'ai_research_venues', label: 'AI research venues & preprints', domains: ['openreview.net', 'neurips.cc', 'icml.cc', 'iclr.cc', 'aclanthology.org', 'paperswithcode.com', 'semanticscholar.org', 'distill.pub'], roles: { ai_research: 0.56, academic: 0.2, ml_engineer: 0.12, ai_safety: 0.12 } },
    { id: 'ai_safety_pubs', label: 'AI safety & alignment research', domains: ['alignmentforum.org', 'lesswrong.com', 'safe.ai', 'aisi.gov.uk', 'anthropic.com/research', 'far.ai', 'apolloresearch'], roles: { ai_safety: 0.54, ai_research: 0.18, ai_red_team: 0.14, academic: 0.14 } },
    { id: 'ai_governance', label: 'AI governance & assurance', domains: ['artificialintelligenceact.eu', 'oecd.ai', 'credo.ai', 'holisticai', 'fairly.ai', 'nist.gov', 'iso.org', 'partnershiponai'], roles: { ai_leader: 0.52, legal: 0.18, ai_safety: 0.16, ai_pm: 0.14 } },
    { id: 'ai_annotation', label: 'Annotation & human-data platforms', domains: ['scale.com', 'surgehq.ai', 'labelbox.com', 'snorkel.ai', 'argilla.io', 'prolific.com', 'mercor.com', 'outlier.ai', 'label-studio'], roles: { ai_trainer: 0.58, ml_engineer: 0.18, data_scientist: 0.14, ai_research: 0.1 } },
    { id: 'ai_chat', label: 'AI assistants', domains: ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'copilot.microsoft.com'], roles: { ai_engineer: 0.12, founder: 0.12, seo_content: 0.11, product_manager: 0.11, student: 0.11, growth_marketer: 0.1, technical_writer: 0.09, fullstack: 0.09, data_analyst: 0.08, ai_leader: 0.07 } },

    // --- Software engineering -------------------------------------------
    { id: 'code_review', label: 'Pull request review', domains: [], actions: ['Reviewed PR', 'Reviewed commits'], roles: { backend: 0.2, frontend: 0.2, fullstack: 0.2, devops: 0.1, mobile: 0.1, ai_engineer: 0.1, qa: 0.1 } },
    { id: 'code_read', label: 'Reading source code', domains: [], actions: ['Read code', 'Browsed repo'], roles: { backend: 0.18, frontend: 0.18, fullstack: 0.18, devops: 0.12, ai_engineer: 0.12, mobile: 0.1, security: 0.12 } },
    { id: 'frontend_docs', label: 'Frontend framework docs', domains: ['react.dev', 'nextjs.org', 'vuejs.org', 'svelte.dev', 'angular.', 'tailwindcss.com', 'developer.mozilla.org', 'caniuse.com', 'vitejs.dev'], roles: { frontend: 0.55, fullstack: 0.25, design_engineer: 0.15, mobile: 0.05 } },
    { id: 'backend_docs', label: 'Backend & API docs', domains: ['fastapi.tiangolo', 'djangoproject', 'spring.io', 'go.dev', 'rust-lang.org', 'nestjs.com', 'laravel.com', 'rubyonrails.org', 'postgresql.org', 'redis.io'], roles: { backend: 0.55, fullstack: 0.25, data_engineer: 0.1, devops: 0.1 } },
    { id: 'cloud_console', label: 'Cloud consoles', domains: ['console.aws.amazon.com', 'portal.azure.com', 'console.cloud.google.com', 'vercel.com', 'render.com', 'fly.io', 'railway.app', 'digitalocean.com'], roles: { devops: 0.38, backend: 0.18, fullstack: 0.14, mlops: 0.14, solutions_arch: 0.1, forward_deployed: 0.06 } },
    { id: 'infra_tools', label: 'Infrastructure & orchestration', domains: ['kubernetes.io', 'terraform.io', 'hashicorp.com', 'docker.com', 'grafana', 'datadoghq.com', 'pagerduty.com', 'argoproj', 'pulumi.com'], roles: { devops: 0.6, mlops: 0.15, backend: 0.15, solutions_arch: 0.1 } },
    { id: 'security_tools', label: 'Security tooling & advisories', domains: ['snyk.io', 'owasp.org', 'cve.mitre.org', 'nvd.nist.gov', 'hackerone.com', 'burpsuite', 'portswigger.net', 'virustotal.com', 'shodan.io'], roles: { security: 0.55, soc_analyst: 0.25, devops: 0.1, backend: 0.1 } },
    { id: 'siem', label: 'SIEM & detection platforms', domains: ['splunk.com', 'crowdstrike.com', 'sentinelone.com', 'elastic.co', 'wiz.io', 'securityonion'], roles: { soc_analyst: 0.72, security: 0.2, devops: 0.08 } },
    { id: 'mobile_dev', label: 'Mobile platform docs', domains: ['developer.apple.com', 'developer.android.com', 'reactnative.dev', 'flutter.dev', 'expo.dev', 'appstoreconnect', 'play.google.com'], roles: { mobile: 0.7, fullstack: 0.15, frontend: 0.15 } },
    { id: 'qa_tools', label: 'Test automation platforms', domains: ['playwright.dev', 'cypress.io', 'browserstack.com', 'saucelabs.com', 'testrail', 'selenium.dev'], roles: { qa: 0.65, frontend: 0.15, fullstack: 0.1, devops: 0.1 } },
    { id: 'game_dev', label: 'Game engines', domains: ['unity.com', 'unrealengine.com', 'godotengine.org', 'itch.io', 'steamworks'], roles: { game_dev: 0.75, embedded: 0.1, content_creator: 0.15 } },
    { id: 'web3', label: 'Blockchain tooling', domains: ['etherscan.io', 'solana.com', 'alchemy.com', 'infura', 'hardhat.org', 'ethereum.org', 'opensea.io'], roles: { web3: 0.8, backend: 0.1, founder: 0.1 } },
    { id: 'embedded', label: 'Embedded & robotics', domains: ['ros.org', 'arduino.cc', 'raspberrypi.com', 'espressif.com', 'mathworks.com', 'digikey.com', 'mouser.com'], roles: { embedded: 0.75, game_dev: 0.05, academic: 0.2 } },
    { id: 'pkg_registry', label: 'Package registries', domains: ['npmjs.com', 'pypi.org', 'crates.io', 'packagist.org', 'rubygems.org', 'nuget.org', 'maven'], roles: { backend: 0.2, frontend: 0.2, fullstack: 0.25, ai_engineer: 0.15, devops: 0.1, mobile: 0.1 } },
    { id: 'qna', label: 'Q&A and developer forums', domains: ['stackoverflow.com', 'stackexchange.com', 'serverfault.com'], roles: { backend: 0.15, frontend: 0.15, fullstack: 0.2, data_engineer: 0.1, devops: 0.1, student: 0.15, qa: 0.05, mobile: 0.1 } },

    // --- Data -----------------------------------------------------------
    { id: 'warehouse', label: 'Data warehouses', domains: ['snowflake.com', 'databricks.com', 'bigquery', 'redshift', 'clickhouse.com', 'motherduck'], roles: { data_engineer: 0.4, analytics_engineer: 0.25, data_scientist: 0.15, data_analyst: 0.2 } },
    { id: 'pipeline', label: 'Pipelines & orchestration', domains: ['getdbt.com', 'dbt.com', 'airflow.apache.org', 'dagster.io', 'prefect.io', 'fivetran.com', 'airbyte.com', 'kafka.apache.org'], roles: { data_engineer: 0.45, analytics_engineer: 0.4, mlops: 0.15 } },
    { id: 'bi_tools', label: 'BI & dashboards', domains: ['looker', 'tableau.com', 'powerbi', 'metabase.com', 'mode.com', 'hex.tech', 'preset.io', 'sigmacomputing'], roles: { data_analyst: 0.4, analytics_engineer: 0.25, data_scientist: 0.15, product_manager: 0.1, revops: 0.1 } },
    { id: 'notebooks', label: 'Notebooks & analysis', domains: ['colab.research.google.com', 'jupyter', 'kaggle.com', 'deepnote.com', 'observablehq.com', 'posit.co', 'rstudio'], roles: { data_scientist: 0.42, ml_engineer: 0.19, academic: 0.14, data_analyst: 0.14, ai_research: 0.06, bioinformatics: 0.05 } },
    { id: 'stats_docs', label: 'Statistical & numeric libraries', domains: ['pandas.pydata.org', 'numpy.org', 'scikit-learn.org', 'scipy.org', 'statsmodels', 'cran.r-project'], roles: { data_scientist: 0.4, ml_engineer: 0.2, academic: 0.2, data_analyst: 0.2 } },
    { id: 'product_analytics', label: 'Product analytics', domains: ['amplitude.com', 'mixpanel.com', 'posthog.com', 'heap.io', 'analytics.google.com', 'plausible.io'], roles: { product_manager: 0.3, data_analyst: 0.25, growth_marketer: 0.25, analytics_engineer: 0.1, founder: 0.1 } },

    // --- Product / design ------------------------------------------------
    { id: 'roadmap', label: 'Roadmap & issue trackers', domains: ['atlassian.net', 'jira', 'linear.app', 'shortcut.com', 'productboard.com', 'aha.io'], actions: ['Worked ticket'], roles: { product_manager: 0.3, project_manager: 0.2, fullstack: 0.12, backend: 0.1, frontend: 0.1, qa: 0.08, ai_pm: 0.1 } },
    { id: 'design_tools', label: 'Design tools', domains: ['figma.com', 'sketch.com', 'framer.com', 'penpot.app', 'excalidraw.com'], roles: { product_designer: 0.45, design_engineer: 0.2, frontend: 0.1, brand_designer: 0.15, product_manager: 0.1 } },
    { id: 'creative_suite', label: 'Creative & brand tools', domains: ['adobe.com', 'canva.com', 'dribbble.com', 'behance.net', 'unsplash.com', 'coolors.co', 'fonts.google.com'], roles: { brand_designer: 0.45, product_designer: 0.2, content_creator: 0.2, growth_marketer: 0.15 } },
    { id: 'video_edit', label: 'Video production', domains: ['descript.com', 'frame.io', 'runwayml.com', 'capcut.com', 'streamlabs', 'studio.youtube.com', 'vimeo.com'], roles: { content_creator: 0.6, community: 0.15, growth_marketer: 0.15, dev_advocate: 0.1 } },
    { id: 'user_research', label: 'User research & testing', domains: ['dovetail', 'usertesting.com', 'maze.co', 'lookback.io', 'hotjar.com', 'userinterviews.com', 'typeform.com'], roles: { ux_researcher: 0.55, product_designer: 0.2, product_manager: 0.15, growth_marketer: 0.1 } },

    // --- Go-to-market ----------------------------------------------------
    { id: 'crm', label: 'CRM platforms', domains: ['salesforce.com', 'hubspot.com', 'pipedrive.com', 'close.com', 'attio.com'], roles: { sales_ae: 0.33, revops: 0.24, customer_success: 0.19, founder: 0.1, growth_marketer: 0.09, forward_deployed: 0.05 } },
    { id: 'sales_engagement', label: 'Sales engagement & prospecting', domains: ['outreach.io', 'salesloft.com', 'apollo.io', 'gong.io', 'zoominfo.com', 'lusha.com', 'clay.com'], roles: { sales_ae: 0.55, revops: 0.2, recruiter: 0.15, growth_marketer: 0.1 } },
    { id: 'support_desk', label: 'Support desks', domains: ['zendesk.com', 'intercom.com', 'freshdesk.com', 'helpscout', 'front.com'], roles: { support_engineer: 0.33, customer_success: 0.33, community: 0.14, revops: 0.14, forward_deployed: 0.06 } },
    { id: 'ad_platforms', label: 'Ad & campaign platforms', domains: ['ads.google.com', 'business.facebook.com', 'ads.tiktok.com', 'ads.linkedin.com', 'adsmanager'], roles: { growth_marketer: 0.7, founder: 0.15, seo_content: 0.15 } },
    { id: 'seo_tools', label: 'SEO & content tools', domains: ['ahrefs.com', 'semrush.com', 'search.google.com', 'moz.com', 'surferseo', 'clearscope'], roles: { seo_content: 0.65, growth_marketer: 0.25, founder: 0.1 } },
    { id: 'email_marketing', label: 'Lifecycle & email marketing', domains: ['mailchimp.com', 'klaviyo.com', 'customer.io', 'braze.com', 'beehiiv.com', 'substack.com', 'convertkit'], roles: { growth_marketer: 0.45, seo_content: 0.25, founder: 0.2, community: 0.1 } },
    { id: 'community_platforms', label: 'Community platforms', domains: ['discord.com', 'circle.so', 'discourse', 'meetup.com'], roles: { community: 0.5, dev_advocate: 0.25, growth_marketer: 0.15, support_engineer: 0.1 } },
    { id: 'devrel', label: 'Developer relations surfaces', domains: ['dev.to', 'hashnode', 'sessionize.com', 'cfp.', 'speakerdeck.com'], roles: { dev_advocate: 0.45, technical_writer: 0.2, fullstack: 0.15, community: 0.2 } },

    // --- Operations -------------------------------------------------------
    { id: 'ats', label: 'Applicant tracking & hiring', domains: ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'workable.com', 'smartrecruiters.com', 'teamtailor.com', 'jobvite.com'], roles: { recruiter: 0.7, people_ops: 0.2, founder: 0.1 } },
    { id: 'hris', label: 'HR & payroll systems', domains: ['workday.com', 'bamboohr.com', 'gusto.com', 'rippling.com', 'deel.com', 'hibob.com'], roles: { people_ops: 0.65, finance: 0.2, founder: 0.15 } },
    { id: 'accounting', label: 'Accounting & billing', domains: ['quickbooks', 'xero.com', 'netsuite', 'bill.com', 'ramp.com', 'brex.com', 'dashboard.stripe.com'], roles: { finance: 0.6, founder: 0.25, revops: 0.15 } },
    { id: 'legal_tools', label: 'Legal & compliance', domains: ['docusign.com', 'ironcladapp.com', 'lexisnexis', 'westlaw', 'vanta.com', 'drata.com', 'clio.com'], roles: { legal: 0.6, people_ops: 0.15, finance: 0.15, security: 0.1 } },
    { id: 'pm_boards', label: 'Delivery & planning boards', domains: ['monday.com', 'asana.com', 'trello.com', 'clickup.com', 'smartsheet', 'wrike.com'], roles: { project_manager: 0.4, product_manager: 0.25, people_ops: 0.1, founder: 0.15, growth_marketer: 0.1 } },
    { id: 'founder_tools', label: 'Company-building tools', domains: ['ycombinator.com', 'crunchbase.com', 'angel.co', 'wellfound.com', 'carta.com', 'producthunt.com'], roles: { founder: 0.7, growth_marketer: 0.15, recruiter: 0.15 } },

    // --- Writing / research ------------------------------------------------
    { id: 'docs_authoring', label: 'Documentation authoring', domains: ['readthedocs', 'gitbook.com', 'mintlify', 'docusaurus.io', 'confluence'], roles: { technical_writer: 0.5, dev_advocate: 0.2, backend: 0.15, product_manager: 0.15 } },
    { id: 'academic_pubs', label: 'Academic literature', domains: ['arxiv.org', 'scholar.google', 'pubmed', 'sciencedirect', 'jstor.org', 'springer', 'nature.com', 'ieee.org', 'acm.org'], roles: { academic: 0.4, ai_research: 0.14, ai_safety: 0.08, ml_engineer: 0.13, bioinformatics: 0.13, data_scientist: 0.12 } },
    { id: 'bioinformatics', label: 'Biological data resources', domains: ['ncbi.nlm.nih.gov', 'ensembl.org', 'uniprot.org', 'bioconductor', 'galaxyproject', 'rcsb.org'], roles: { bioinformatics: 0.75, academic: 0.2, data_scientist: 0.05 } },
    { id: 'clinical', label: 'Clinical references', domains: ['uptodate.com', 'medscape.com', 'epocrates', 'nice.org.uk', 'who.int', 'cdc.gov'], roles: { clinician: 0.7, bioinformatics: 0.1, academic: 0.2 } },
    { id: 'lms', label: 'Courses & learning platforms', domains: ['coursera.org', 'udemy.com', 'edx.org', 'canvas', 'blackboard', 'moodle', 'khanacademy.org', 'pluralsight', 'frontendmasters'], roles: { student: 0.45, educator: 0.25, academic: 0.15, fullstack: 0.15 } },
    { id: 'teaching', label: 'Teaching & classroom tools', domains: ['classroom.google.com', 'kahoot', 'nearpod', 'quizlet', 'gradescope'], roles: { educator: 0.75, student: 0.2, academic: 0.05 } },

    // --- Behavioural (action-derived) ---------------------------------------
    { id: 'writing_docs', label: 'Writing documents & decks', domains: [], actions: ['Edited doc', 'Edited deck', 'Wrote notes'], roles: { product_manager: 0.17, technical_writer: 0.17, founder: 0.11, project_manager: 0.11, people_ops: 0.09, academic: 0.09, seo_content: 0.09, legal: 0.09, ai_leader: 0.08 } },
    { id: 'spreadsheets', label: 'Working in spreadsheets', domains: [], actions: ['Edited sheet'], roles: { finance: 0.25, data_analyst: 0.2, revops: 0.15, project_manager: 0.12, growth_marketer: 0.1, founder: 0.1, people_ops: 0.08 } },
    { id: 'designing', label: 'Time inside a design file', domains: [], actions: ['Designed'], roles: { product_designer: 0.5, design_engineer: 0.2, brand_designer: 0.2, frontend: 0.1 } }
  ],

  /* ---------------------------------------------------------------------
     A note on generic sites
     ---------------------------------------------------------------------
     There is deliberately no blocklist of "sites everyone uses". A domain
     produces evidence only when a signal above names it, and no signal names
     a search engine, a video site or a social feed - so an hour on YouTube
     contributes exactly nothing and needs no special case. A blocklist would
     be dead code that still had to be maintained, and its one real effect
     would be the accidents: 'amazon.' silently killing the AWS console,
     'google.com' killing Colab, Ads, Analytics and Search Console.

     The broad signals that DO exist - AI assistants, Q&A sites - spread their
     weight thinly across many roles, which is the honest handling: they say a
     little about several jobs and cannot decide anything on their own.
     ------------------------------------------------------------------- */

  /* ---------------------------------------------------------------------
     What it takes before anything is claimed at all.

     These are the whole ballgame. Loosening any one of them turns this from
     an inference into a horoscope.
     ------------------------------------------------------------------- */
  REQUIREMENTS: {
    // Total time across matched signals. Well under an hour of recognisable
    // tooling is one afternoon of curiosity, not a pattern of work.
    minEvidenceSeconds: 2700,
    // Distinct signal groups. Two is the floor: one tool, however heavily
    // used, is a habit rather than a job.
    minDistinctSignals: 2,
    // Distinct tools underneath those groups. This is what stops two groups
    // from being accepted on the strength of two sites - a SOC analyst living
    // in five security products legitimately trips only two signal groups, and
    // refusing them would be as wrong as guessing.
    minDistinctSources: 4,
    // Distinct days. A single intense day cannot establish what someone does.
    minDistinctDays: 3,
    // How far the leader must sit above the runner-up before it is named at
    // all, as a fraction of the leader's own score.
    minMargin: 0.15,
    // Share of total evidence the leader must hold. Guards the case where
    // every role scores similarly and the leader wins by rounding. Held below
    // a quarter because weight is spread across a wide role catalogue: a clear
    // frontend engineer lands near 30%, not near 60%.
    minShare: 0.18
  },

  // Days of history the inference reads. Long enough to survive a week of
  // unusual work, short enough that a career change shows up within a month.
  LOOKBACK_DAYS: 21,

  /**
   * Does a signal claim this domain?
   *
   * Suffix-aware so 'figma.com' matches 'www.figma.com' without also matching
   * an unrelated host that merely contains the string. Patterns carrying a
   * path or a leading subdomain fall back to substring matching, which is what
   * they are written for ('console.aws.amazon.com', 'linkedin.com/talent').
   */
  matchesDomain(pattern, domain, url) {
    const p = String(pattern || '').toLowerCase();
    const host = String(domain || '').toLowerCase();
    if (!p || !host) return false;

    if (p.indexOf('/') !== -1) {
      return String(url || host).toLowerCase().includes(p);
    }
    if (p.endsWith('.')) return host.includes(p);
    return host === p || host.endsWith('.' + p) || host.includes(p);
  },

  /**
   * Turn a stretch of days into per-signal evidence.
   *
   * Evidence is measured in seconds AND in distinct days, because the two say
   * different things: seconds say how much of the work this tool is, days say
   * whether it is the job or last Tuesday.
   *
   * @param {Array<{dateKey: string, day: object}>} days
   * @returns {{signals: object, totalSeconds: number, daysSeen: number}}
   */
  collectEvidence(days) {
    const signals = {};
    let totalSeconds = 0;
    const evidenceDays = new Set();
    const evidenceSources = new Set();

    const credit = (signal, seconds, dateKey, sourceLabel) => {
      if (!(seconds > 0)) return;
      const bucket = signals[signal.id] || (signals[signal.id] = {
        id: signal.id,
        label: signal.label,
        roles: signal.roles,
        seconds: 0,
        days: new Set(),
        sources: new Set()
      });
      bucket.seconds += seconds;
      bucket.days.add(dateKey);
      if (sourceLabel) {
        bucket.sources.add(sourceLabel);
        evidenceSources.add(sourceLabel);
      }
      totalSeconds += seconds;
      evidenceDays.add(dateKey);
    };

    (days || []).forEach(({ dateKey, day }) => {
      if (!day) return;

      // Domain evidence: where the time went.
      const domains = day.domains || {};
      Object.keys(domains).forEach((domain) => {
        const seconds = Number(domains[domain]) || 0;
        if (seconds <= 0) return;

        this.SIGNALS.forEach((signal) => {
          if (!signal.domains || signal.domains.length === 0) return;
          if (signal.domains.some(p => this.matchesDomain(p, domain))) {
            credit(signal, seconds, dateKey, domain);
          }
        });
      });

      // Action evidence: what was being done. Reviewing a pull request is a
      // stronger statement than sitting on github.com, and it is already
      // recorded, so it costs nothing extra to read.
      const activities = day.activities || {};
      Object.keys(activities).forEach((key) => {
        const activity = activities[key];
        if (!activity || !(activity.seconds > 0)) return;

        this.SIGNALS.forEach((signal) => {
          if (!signal.actions || signal.actions.length === 0) return;
          if (signal.actions.indexOf(activity.action) !== -1) {
            // The verb is the source here, not the site. "Spent the day in a
            // design file" is evidence of a different kind from "visited
            // figma.com", and counting it as the same source would penalise
            // exactly the people whose whole job lives in one application.
            credit(signal, activity.seconds, dateKey, activity.action);
          }
        });
      });
    });

    return {
      signals,
      totalSeconds,
      daysSeen: evidenceDays.size,
      sourcesSeen: evidenceSources.size
    };
  },

  /**
   * Score every role against the collected evidence.
   *
   * Seconds enter through a square root, so a tool that soaks up an entire
   * week cannot drown out three other tools that each say something different.
   * Days enter as a modest multiplier, which is what separates a routine from
   * a one-off.
   */
  scoreRoles(signals) {
    const scores = {};

    Object.keys(signals).forEach((id) => {
      const bucket = signals[id];
      const minutes = bucket.seconds / 60;
      const dayCount = bucket.days.size;
      const strength = Math.sqrt(minutes) * (1 + 0.18 * Math.min(dayCount - 1, 10));

      Object.keys(bucket.roles).forEach((roleId) => {
        if (!this.ROLES[roleId]) return;
        scores[roleId] = (scores[roleId] || 0) + bucket.roles[roleId] * strength;
      });
    });

    return scores;
  },

  /**
   * The signals that actually pushed a given role up, strongest first.
   */
  evidenceFor(roleId, signals, limit = 6) {
    return Object.keys(signals)
      .map(id => signals[id])
      .filter(bucket => (bucket.roles[roleId] || 0) > 0)
      .map(bucket => ({
        id: bucket.id,
        label: bucket.label,
        seconds: Math.round(bucket.seconds),
        days: bucket.days.size,
        weight: bucket.roles[roleId],
        sources: Array.from(bucket.sources).slice(0, 4),
        contribution: bucket.roles[roleId] * Math.sqrt(bucket.seconds / 60)
      }))
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, limit);
  },

  /**
   * Name what is missing, in the user's terms rather than the model's.
   */
  describeShortfall(stats) {
    const need = this.REQUIREMENTS;
    const gaps = [];

    if (stats.totalSeconds < need.minEvidenceSeconds) {
      const short = Math.ceil((need.minEvidenceSeconds - stats.totalSeconds) / 60);
      gaps.push(`about ${short} more minutes on tools it recognises`);
    }
    if (stats.distinctSignals < need.minDistinctSignals) {
      const short = need.minDistinctSignals - stats.distinctSignals;
      gaps.push(`${short} more kind${short === 1 ? '' : 's'} of work tool`);
    }
    if (stats.distinctSources < need.minDistinctSources) {
      const short = need.minDistinctSources - stats.distinctSources;
      gaps.push(`${short} more recognisable site${short === 1 ? '' : 's'}`);
    }
    if (stats.daysSeen < need.minDistinctDays) {
      gaps.push(`${need.minDistinctDays - stats.daysSeen} more day${need.minDistinctDays - stats.daysSeen === 1 ? '' : 's'} of tracking`);
    }
    return gaps;
  },

  /**
   * Infer a work profile from a window of daily records.
   *
   * @param {Array<{dateKey: string, day: object}>} days
   * @param {object} [settings] user settings; a stated role short-circuits.
   * @returns {object} always shaped the same way, whatever the outcome:
   *   { status, roleId, label, confidence, sharePercent, evidence, alternatives,
   *     stats, disclaimer }
   *   status is one of 'stated' | 'insufficient' | 'ambiguous' | 'inferred'.
   */
  infer(days, settings) {
    const prefs = (settings && settings.workProfile) || {};

    // A stated role is not a detection and must never be dressed up as one.
    if (prefs.override && this.ROLES[prefs.override]) {
      const role = this.ROLES[prefs.override];
      return {
        status: 'stated',
        roleId: prefs.override,
        label: role.label,
        family: role.family,
        icon: role.icon,
        aliases: role.aliases || [],
        confidence: 'stated',
        confidenceLabel: 'Set by you',
        sharePercent: null,
        evidence: [],
        alternatives: [],
        stats: { daysSeen: 0, distinctSignals: 0, distinctSources: 0, totalSeconds: 0 },
        disclaimer: 'You set this yourself. Tasker is not guessing here.'
      };
    }

    const { signals, totalSeconds, daysSeen, sourcesSeen } = this.collectEvidence(days);
    const distinctSignals = Object.keys(signals).length;
    const stats = {
      totalSeconds: Math.round(totalSeconds),
      distinctSignals,
      distinctSources: sourcesSeen,
      daysSeen,
      windowDays: this.LOOKBACK_DAYS
    };

    const need = this.REQUIREMENTS;
    const belowFloor = totalSeconds < need.minEvidenceSeconds ||
      distinctSignals < need.minDistinctSignals ||
      sourcesSeen < need.minDistinctSources ||
      daysSeen < need.minDistinctDays;

    if (belowFloor) {
      return {
        status: 'insufficient',
        roleId: null,
        label: 'Not enough evidence yet',
        confidence: 'none',
        confidenceLabel: 'No call',
        sharePercent: null,
        evidence: [],
        alternatives: [],
        stats,
        shortfall: this.describeShortfall(stats),
        disclaimer: 'Tasker will not guess your role from a handful of visits. ' +
          'It needs a recognisable pattern across several days first.'
      };
    }

    const scores = this.scoreRoles(signals);
    const ranked = Object.keys(scores)
      .map(roleId => ({ roleId, score: scores[roleId] }))
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) {
      return {
        status: 'insufficient',
        roleId: null,
        label: 'Not enough evidence yet',
        confidence: 'none',
        confidenceLabel: 'No call',
        sharePercent: null,
        evidence: [],
        alternatives: [],
        stats,
        shortfall: ['a recognisable work tool in your browsing'],
        disclaimer: 'None of the sites tracked so far map to a known way of working.'
      };
    }

    const totalScore = ranked.reduce((sum, r) => sum + r.score, 0) || 1;
    const leader = ranked[0];
    const runnerUp = ranked[1] || { score: 0 };
    const margin = leader.score > 0 ? (leader.score - runnerUp.score) / leader.score : 0;
    const share = leader.score / totalScore;

    const alternatives = ranked.slice(1, 4).map(r => ({
      roleId: r.roleId,
      label: this.ROLES[r.roleId].label,
      icon: this.ROLES[r.roleId].icon,
      aliases: this.ROLES[r.roleId].aliases || [],
      sharePercent: Math.round((r.score / totalScore) * 100)
    }));

    // Too close to call. Report the shortlist rather than promoting whichever
    // one happened to land a fraction ahead.
    if (margin < need.minMargin || share < need.minShare) {
      return {
        status: 'ambiguous',
        roleId: null,
        label: 'Several patterns, none dominant',
        confidence: 'low',
        confidenceLabel: 'Too close to call',
        sharePercent: Math.round(share * 100),
        candidates: [{
          roleId: leader.roleId,
          label: this.ROLES[leader.roleId].label,
          icon: this.ROLES[leader.roleId].icon,
          aliases: this.ROLES[leader.roleId].aliases || [],
          sharePercent: Math.round(share * 100)
        }].concat(alternatives),
        evidence: this.evidenceFor(leader.roleId, signals),
        alternatives,
        stats,
        disclaimer: 'Your browsing matches more than one way of working about equally. ' +
          'Rather than pick one, Tasker is showing you the shortlist.'
      };
    }

    // Confident enough to name one. The tier still reflects how much is
    // actually behind it.
    let confidence = 'moderate';
    let confidenceLabel = 'Likely';
    if (margin >= 0.30 && distinctSignals >= 4 && sourcesSeen >= 6 && daysSeen >= 7 && totalSeconds >= 4 * 3600) {
      confidence = 'high';
      confidenceLabel = 'Strong signal';
    } else if (margin < 0.22 || sourcesSeen < 5) {
      confidence = 'emerging';
      confidenceLabel = 'Early signal';
    }

    const role = this.ROLES[leader.roleId];
    return {
      status: 'inferred',
      roleId: leader.roleId,
      label: role.label,
      family: role.family,
      icon: role.icon,
      aliases: role.aliases || [],
      confidence,
      confidenceLabel,
      sharePercent: Math.round(share * 100),
      marginPercent: Math.round(margin * 100),
      evidence: this.evidenceFor(leader.roleId, signals),
      alternatives,
      stats,
      disclaimer: 'This is what your browsing looks like, not a verified fact about you. ' +
        'It is inferred on this device from the tools you spend time in, and you can override it in Settings.'
    };
  },

  /**
   * The other names the same work is advertised under.
   *
   * Worth surfacing because the 2026 AI market prices the title, not the job:
   * the same retrieval work is posted as AI Engineer, Applied AI Engineer,
   * GenAI Engineer and LLM Engineer, at materially different salaries. Tasker
   * cannot tell those apart from browsing - they are the same tools in the
   * same tabs - so rather than pick one and imply a precision it does not
   * have, it names the family.
   */
  aliasNote(result) {
    const aliases = (result && result.aliases) || [];
    if (aliases.length === 0) return '';
    return `Also advertised as ${aliases.join(', ')}. ` +
      `Tasker cannot tell these apart from browsing - the tools are identical - ` +
      `so it reports the family rather than picking one.`;
  },

  /**
   * One plain sentence stating the finding and what it rests on.
   * Used in the popup, the dashboard and the PDF header, so the wording of the
   * claim cannot drift between them.
   */
  summarize(result) {
    if (!result) return '';

    if (result.status === 'stated') {
      return `Work profile: ${result.label} (set by you).`;
    }
    if (result.status === 'insufficient') {
      const gaps = (result.shortfall || []).join(', ');
      return gaps
        ? `No work profile yet — Tasker needs ${gaps} before it will say anything.`
        : 'No work profile yet — not enough recognisable tools tracked.';
    }
    if (result.status === 'ambiguous') {
      const names = (result.candidates || []).slice(0, 3).map(c => c.label).join(', ');
      return `Your browsing matches several profiles about equally: ${names}.`;
    }

    const hours = Math.round((result.stats.totalSeconds / 3600) * 10) / 10;
    return `Your browsing looks like ${result.label} — ${result.confidenceLabel.toLowerCase()}, ` +
      `from ${result.stats.distinctSources} tools over ${result.stats.daysSeen} days ` +
      `(${hours}h of recognised activity).`;
  }
};

if (typeof globalThis !== 'undefined') {
  globalThis.RoleDetector = RoleDetector;
}
