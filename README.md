# Vibe Workflow — Open-Source Alternative to Weavy AI, Freepik Spaces, Krea Nodes & FloraFauna AI

**Vibe Workflow** is a free, open-source node-based AI workflow builder — the self-hostable alternative to [Weavy.ai](https://weavy.ai), [Freepik Spaces](https://freepik.com), [Krea Nodes](https://krea.ai), and [FloraFauna AI](https://florafauna.ai). Designed around "Artistic Intelligence," it gives creators and developers a visual, modular pipeline editor for designing, editing, and composing AI-generated images and video — with no vendor lock-in.

<img width="1536" height="1024" alt="Vibe Workflow — open-source AI workflow builder alternative to Weavy AI, Krea Nodes, Freepik Spaces, FloraFauna AI" src="https://github.com/user-attachments/assets/a11ff6c1-83bf-4c09-ac58-03ccffffd84c" />

> **Looking for a Weavy AI alternative? A Krea Nodes alternative? A Freepik Spaces alternative? A FloraFauna AI alternative?**
> Vibe Workflow is fully open-source, self-hostable, and free — with the same node-based visual editor you know and love.

---

## Why Vibe Workflow Over Weavy AI / Krea Nodes / Freepik Spaces / FloraFauna AI?

| Feature | Vibe Workflow | Weavy AI | Krea Nodes | Freepik Spaces | FloraFauna AI |
|---|---|---|---|---|---|
| Open Source | ✅ MIT | ❌ | ❌ | ❌ | ❌ |
| Self-Hostable | ✅ | ❌ | ❌ | ❌ | ❌ |
| Node-Based Editor | ✅ | ✅ | ✅ | Partial | ✅ |
| Custom AI Models | ✅ | Limited | Limited | ❌ | Limited |
| No Subscription | ✅ | ❌ | ❌ | ❌ | ❌ |
| Extendable / API | ✅ | Limited | Limited | ❌ | Limited |

Vibe Workflow bridges the gap between complex generative AI capabilities and intuitive visual design. Where tools like Weavy AI and Krea Nodes offer powerful node-based systems behind paywalls, Vibe Workflow gives you the same power — open-source, flexible, and extendable:

- **Creative Professionals**: Build custom AI pipelines for high-volume asset production.
- **Studios**: Maintain brand consistency across hundreds of generative variations.
- **Developers**: Extend and integrate generative AI into any existing workflow via API.
- **Researchers**: Self-host and experiment with any AI model stack — no usage caps.

---

## Features

- **Node-Based AI Workflow Editor** — Visual, modular pipelines for generative AI, similar in spirit to Krea Nodes and Weavy AI workflows but fully open-source (inspired by Blender Nodes and ComfyUI).
- **Artistic Intelligence** — A design philosophy bridging human creativity and AI automation; the same creative-first approach seen in FloraFauna AI and Freepik Spaces.
- **Generative Image & Video** — Integrated support for image and video generation powered by **MuAPI** (Vadoo AI).
- **Self-Hosted & Private** — Run entirely on your own infrastructure. No data sent to third-party SaaS platforms.
- **Extensible Architecture** — Add new AI model nodes, connect external APIs, and build reusable workflow templates.
- **No Vendor Lock-in** — Swap AI providers freely. Unlike Freepik Spaces or FloraFauna AI, you own your stack.

---

## Use Cases

- **AI Image Generation Pipelines** — Build workflows comparable to Freepik Spaces AI tools or FloraFauna AI canvas, on your own server.
- **Video Generation Workflows** — Sequence and automate video generation jobs just like Krea Workflows.
- **Brand Asset Automation** — Replicate what Weavy AI does for enterprise content production, without the SaaS subscription.
- **Custom Model Integration** — Connect LoRAs, custom diffusion models, or any external API as a workflow node.
- **Creative Exploration** — Experiment with generative art pipelines in the same visual style as Krea Nodes or FloraFauna's node canvas.

---

## Project Structure

```text
Vibe-Workflow/
├── client/              # Next.js frontend application
├── packages/
│   └── workflow-builder/ # Shared UI library — the core node editor
└── server/              # FastAPI backend
```

---

## Getting Started

### Prerequisites

- **Node.js** v18+
- **Python** v3.8+
- **npm** v7+ (workspaces support)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/vibe-workflow.git
   cd vibe-workflow
   ```

2. **Install all dependencies** (root directory):
   ```bash
   npm install
   ```
   This installs dependencies for the client, the workflow-builder library, and links them via npm workspaces.

### Configuration

Vibe Workflow uses **MuAPI** (Vadoo AI) for generative AI capabilities. You need an API key.

1. **Get your API Key** from [muapi.ai](https://muapi.ai) — sign up, navigate to **API Keys**, generate a key.

2. **Configure the Backend**:
   ```bash
   cd server
   cp .env.example .env
   # Open .env and set:
   # MU_API_KEY=your_actual_api_key_here
   ```

### Running the Project

**Frontend (Next.js):**
```bash
npm run dev:app
# Available at http://localhost:3000
```

**Backend (FastAPI):**
```bash
cd server
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# API available at http://localhost:8000
```

---

## Development

- **Workflow-Builder Library** — To rebuild the core node editor:
  ```bash
  npm run build:lib
  ```
- **Client App** — Uses the local library. Rebuild the library after changes if not using a watcher:
  ```bash
  npm run dev:app
  ```

---

## Comparisons

### Vibe Workflow vs Weavy AI
Weavy AI is a proprietary node-based creative AI platform. Vibe Workflow is its open-source equivalent — same visual workflow paradigm, fully self-hostable, MIT licensed, with no subscription fees.

### Vibe Workflow vs Krea Nodes / Krea Workflows
Krea Nodes offers a powerful real-time generative canvas. Vibe Workflow brings a comparable node-based editor that is open-source, customizable, and extendable with any AI backend.

### Vibe Workflow vs Freepik Spaces
Freepik Spaces is a cloud-based AI creative suite integrated with Freepik's asset library. Vibe Workflow provides the workflow and pipeline layer as open-source infrastructure you control, with no asset-library lock-in.

### Vibe Workflow vs FloraFauna AI
FloraFauna AI offers a creative node canvas for generative media. Vibe Workflow replicates and extends that concept in an open-source, self-hosted package with full extensibility.

---

## Keywords / Tags

`weavy-ai-alternative` · `krea-nodes-alternative` · `freepik-spaces-alternative` · `florafauna-ai-alternative` · `open-source-ai-workflow` · `node-based-ai-editor` · `generative-ai-pipeline` · `comfyui-alternative` · `visual-ai-workflow` · `self-hosted-ai` · `ai-image-generation` · `ai-video-generation` · `no-code-ai` · `artistic-intelligence`

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE)
