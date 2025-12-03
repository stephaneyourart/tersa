# 3. Technical Schemas

## High-Level Architecture

```mermaid
graph TD
    Client[Web Client (Next.js)] -->|API Calls| Cloud[Cloud AI Providers]
    Client -->|Local API| LocalServer[Local Node.js Server]
    LocalServer -->|File Ops| FS[File System]
    LocalServer -->|Bridge| Python[Python Bridge Script]
    Python -->|Scripting API| DVR[DaVinci Resolve]
    
    subgraph "Canvas State"
        Nodes[React Flow Nodes]
        Edges[Connections]
        Viewport[Zoom/Pan State]
    end
```

## Data Structures (JSON Types)

### Project Structure
```json
{
  "id": "project-uuid",
  "name": "My Creative Project",
  "data": {
    "nodes": [
      {
        "id": "node-1",
        "type": "image",
        "position": { "x": 0, "y": 0 },
        "data": {
          "prompt": "A futuristic city",
          "modelId": "flux-pro",
          "generated": {
            "url": "/storage/images/img_123.png",
            "width": 1024,
            "height": 1024
          },
          "dvrMetadata": {
            "title": "Futuristic City Intro",
            "analyzedAt": "2025-12-03T10:00:00Z"
          }
        }
      }
    ],
    "edges": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

### Collection Item
```json
{
  "id": "item-uuid",
  "type": "video",
  "url": "/storage/videos/vid_456.mp4",
  "enabled": true,
  "metadata": {
    "prompt": "Camera flying through neon streets",
    "seed": 987654321
  }
}
```

## Internal Prompts Logic
The system uses specialized system prompts to analyze media content before sending to DaVinci Resolve.

**Example System Prompt for Analysis:**
> "Analyze this image/video and provide a concise JSON output with:
> 1. A short, catchy title (max 5 words).
> 2. A description of the visual decor/setting.
> 3. The mood or atmosphere.
> This metadata will be used to tag the clip in a video editing software."

