# Vibe Workflow

**Vibe Workflow** is an open-source alternative to [Weavy.ai](https://weavy.ai), **FloraFauna**, **Freepik Spaces**, and **Krea Workflows**. Designed to empower creators with "Artistic Intelligence," it features a node-based workflow editor for designing, editing, and composing AI-generated content with professional precision.

<img width="1024" height="1024" alt="vw" src="https://github.com/user-attachments/assets/f603eb13-3b4f-4c9a-9a6a-c4cc3a94f7a6" />

## Why Vibe Workflow?

Vibe Workflow bridges the gap between complex AI capabilities and intuitive design. While tools like Weavy and Krea offer powerful node-based systems, Vibe Workflow provides an open-source, flexible foundation for:
- **Creative Professionals**: Build custom pipelines for high-volume asset production.
- **Studios**: Maintain brand consistency across hundreds of variations.
- **Developers**: Extend and integrate generative AI into existing workflows.

## Features

- **Node-Based Workflows**: Modular, reusable pipelines for generative AI (similar to Blender or ComfyUI).
- **Artistic Intelligence**: Bridge the gap between human creativity and AI automation.
- **Generative Media**: Integrated support for image and video generation powered by **MuAPI** (Vadoo AI).

## Project Structure

This project follows a hybrid monorepo structure:

```text
Vibe-Workflow/
├── client/              # Next.js frontend application
├── packages/
│   └── workflow-builder/ # Shared UI library (The core node editor)
└── server/              # FastAPI backend
```

## Getting Started

### Prerequisites

For local development:
- **Node.js** (v20+)
- **Python** (v3.10+)
- **npm** (v7+ for workspaces support)

Or use **Docker** (see [Running with Docker](#running-with-docker)).

### Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/vibe-workflow.git
    cd vibe-workflow
    ```

2.  **Install dependencies** (from the root directory):
    ```bash
    npm install
    ```
    This command installs dependencies for the client, the library, and links them together via npm workspaces.

### Configuration (Important!)

This project uses **MuAPI** (Vadoo AI) for its generative AI capabilities. You need an API key to run workflows.

1.  **Get your API Key**:
    - Go to the [Vadoo AI / MuAPI Dashboard](https://muapi.ai).
    - Sign up or Log in.
    - Navigate to **API Keys** and generate a new key.

2.  **Configure the Backend**:
    - Navigate to the `server` directory.
    - Copy the example environment file:
      ```bash
      cp .env.example .env
      ```
    - Open `.env` and paste your API key:
      ```bash
      MU_API_KEY=your_actual_api_key_here
      ```

### Running the Project

We have provided convenient scripts in the root `package.json` to manage the project.

**1. Start the Frontend (Next.js)**
```bash
npm run dev:app
```
*The app will be available at [http://localhost:3000](http://localhost:3000)*

**2. Start the Backend (FastAPI)**
```bash
cd server
# Create virtual env if you haven't yet
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
*The API will be available at [http://localhost:8000](http://localhost:8000)*

## Running with Docker

The easiest way to run Vibe Workflow is with Docker Compose.

### Prerequisites

- **Docker** (v20+)
- **Docker Compose** (v2+)

### Quick Start

1. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your MuAPI key:
   ```bash
   MU_API_KEY=your_actual_api_key_here
   ```

2. **Start all services**:
   ```bash
   docker compose up --build
   ```

3. **Access the application**:
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:8000](http://localhost:8000)
   - API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Services

| Service | Image | Port |
|---------|-------|------|
| client | Node.js 24 Alpine | 3000 |
| server | Python 3.13 | 8000 |

### Stopping

```bash
docker compose down
```

## Development

- **Library Development**: If you are working on the core node editor (`packages/workflow-builder`), you can rebuild it specifically:
  ```bash
  npm run build:lib
  ```
- **App Development**: The `client` app is set up to use the local version of the library. Changes in the library may require a rebuild `npm run build:lib` to be reflected if you are not using a watcher.

## Contributing

We welcome contributions to Vibe Workflow! Please see `CONTRIBUTING.md` for details.

## License

MIT
