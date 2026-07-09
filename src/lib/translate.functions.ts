import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

const Input = z.object({ text: z.string().min(1).max(2000), targetLanguage: z.string().min(2).max(30) });

export const translateComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash-lite"),
      prompt: `Translate the following text into ${data.targetLanguage}. Return ONLY the translation, no quotes, no explanation.\n\nText: ${data.text}`,
    });
    return { translation: text.trim() };
  });
