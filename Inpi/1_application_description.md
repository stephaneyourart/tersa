# 1. Application Description

## Name
**Media Conductor**

## Objective
Media Conductor is a local and cloud-based orchestration platform for generative media (image, video, audio, text). It allows creators to visually chain generation models (LLMs, Diffusion Models), manage complex workflows via a node-based interface, and synchronize assets directly with professional editing software like DaVinci Resolve.

## Simple Architecture
The application is built on a hybrid architecture:
- **Frontend**: Next.js (React) application with a node-based canvas (React Flow).
- **Backend (Local)**: Node.js server handling local file system operations (storage, DaVinci Resolve bridge).
- **Backend (Cloud)**: API routes for AI model inference (OpenAI, Replicate, Fal.ai, etc.) and user authentication (Supabase).
- **Bridge**: A Python script acting as a bridge between the web application and the DaVinci Resolve scripting API.

## Workflow Explanation
1.  **Creation**: The user drags and drops nodes onto a canvas (text, image, video, audio).
2.  **Generation**: Nodes are connected to AI models. For example, a text node generates a prompt, which is fed into an image generation node, which is then animated by a video generation node.
3.  **Orchestration**: The user manages parameters (resolution, steps, guidance) and visualizes results in real-time.
4.  **Collection**: Selected results are grouped into "Collections".
5.  **Export/Sync**: Assets are sent to DaVinci Resolve with a single click, including metadata (prompts, technical params) for professional editing.

