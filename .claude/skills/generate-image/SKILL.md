---
name: generate-image
description: >
  Generate images using the Gemini API (gemini-3.1-flash-image-preview model).
  Use this skill whenever the user asks to create, generate, make, draw, design,
  or produce an image, picture, illustration, graphic, photo, icon, logo, banner,
  or any visual content. Also trigger when the user says things like "make me a picture of",
  "create an image showing", "draw X", "generate a visual", "I need an image",
  or any variation of requesting visual/image creation. Even if the user just says
  "show me what X looks like" or "visualize X" — use this skill.
  This skill uses Google's Gemini Flash Image model for high-quality image generation.
---

# Image Generation with Gemini API

When the user asks you to generate an image, follow these steps:

## Step 1: Understand the prompt

Take the user's description and craft a detailed, effective image generation prompt. If the user's request is vague, enhance it with reasonable creative details (lighting, style, composition) while staying true to their intent. If they gave a detailed prompt, use it as-is.

## Step 2: Determine output path

- Default: save to the current working directory
- Use a descriptive filename based on the content (e.g., `sunset-beach.png`, `logo-design.png`)
- If the user specifies a path or filename, use that instead
- Always use `.png` extension unless the API returns a different format

## Step 3: Generate 2-3 variations

Always generate **2-3 slightly different versions** of the image. Each variation should stay faithful to the core prompt but differ in subtle ways — for example:
- Variation 1: The base prompt as-is
- Variation 2: Slightly different angle, lighting, or composition
- Variation 3: A subtle style or mood shift

Create each variation by running the script with a slightly tweaked prompt. The differences should be small and focused — not wildly different images, just enough variety for the user to pick their favorite.

Run each variation as a separate script call:

```bash
node /Users/bigjeff/Desktop/Leadexpress/.claude/skills/generate-image/scripts/generate.mjs "<prompt-variation-1>" "<filename>-v1"
node /Users/bigjeff/Desktop/Leadexpress/.claude/skills/generate-image/scripts/generate.mjs "<prompt-variation-2>" "<filename>-v2"
node /Users/bigjeff/Desktop/Leadexpress/.claude/skills/generate-image/scripts/generate.mjs "<prompt-variation-3>" "<filename>-v3"
```

Run all 3 calls in parallel when possible to save time.

## Step 4: Display ALL images in chat

This is critical — after generating, you MUST display every image directly in the chat using the **Read tool** on each image file. The user expects to see the results inline without having to open files manually.

For each generated image:
1. Use the Read tool to read and display the image file
2. Label each variation (e.g., "Version 1", "Version 2", "Version 3")
3. After showing all versions, ask which one the user prefers or if they want modifications

## Configuration

The script uses the `GEMINI_API_KEY` environment variable. It's pre-configured in the script as a fallback, but you can override it by setting the env var.

## Tips for good prompts

When enhancing the user's prompt, consider adding:
- Art style (photorealistic, watercolor, digital art, 3D render, etc.)
- Lighting (soft, dramatic, golden hour, studio, etc.)
- Composition (close-up, wide angle, bird's eye view, etc.)
- Mood/atmosphere (serene, energetic, mysterious, etc.)

But only add these if the user hasn't already specified their preferences.
