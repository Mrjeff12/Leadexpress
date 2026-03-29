import { GoogleGenAI } from '@google/genai';
import mime from 'mime';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDao886pt9T2kkm28cyr8T9sidfPVaHAYk';

const prompt = process.argv[2];
const outputName = process.argv[3] || 'generated-image';

if (!prompt) {
  console.error('Usage: node generate.mjs "<prompt>" [output-filename]');
  process.exit(1);
}

async function main() {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const config = {
    temperature: 0.8,
    imageConfig: {
      imageSize: '2K',
    },
    responseModalities: ['IMAGE'],
  };

  const model = 'gemini-3.1-flash-image-preview';

  const contents = [
    {
      role: 'user',
      parts: [{ text: prompt }],
    },
  ];

  console.log(`Generating image for: "${prompt}"`);

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });

  let fileIndex = 0;
  let saved = false;

  for await (const chunk of response) {
    if (!chunk.candidates?.[0]?.content?.parts) continue;

    const part = chunk.candidates[0].content.parts[0];

    if (part?.inlineData) {
      const inlineData = part.inlineData;
      const ext = mime.getExtension(inlineData.mimeType || 'image/png') || 'png';
      const suffix = fileIndex > 0 ? `_${fileIndex}` : '';
      const fileName = `${outputName}${suffix}.${ext}`;
      const filePath = resolve(process.cwd(), fileName);
      const buffer = Buffer.from(inlineData.data || '', 'base64');
      writeFileSync(filePath, buffer);
      console.log(`Saved: ${filePath}`);
      saved = true;
      fileIndex++;
    } else if (chunk.text) {
      console.log('Model response:', chunk.text);
    }
  }

  if (!saved) {
    console.error('No image was generated. The model may not have returned image data.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error generating image:', err.message);
  process.exit(1);
});
