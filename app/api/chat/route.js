import { StreamingTextResponse } from "ai";

import { PromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { HttpResponseOutputParser } from "langchain/output_parsers";

export const runtime = "edge";

const formatMessage = (message) => {
  return `${message.role}: ${message.content}`;
};

const TEMPLATE = `You are a safety officer. All responses must be in safety terms
Current conversation: {chat_history}
User: {input}
AI:`;

export async function POST(req) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];

    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    const currentMessageContent = messages[messages.length - 1].content;
    const prompt = PromptTemplate.fromTemplate(TEMPLATE);

    const model = new ChatOpenAI({
      temperature: 0.8,
      modelName: "gpt-3.5-turbo",
    });

    const outputParser = new HttpResponseOutputParser();

    const chain = prompt.pipe(model).pipe(outputParser);

    const stream = await chain.stream({
      chat_history: formattedPreviousMessages.join("\n"),
      input: currentMessageContent,
    });

    return new StreamingTextResponse(stream);
  } catch (error) {
    return new Response(JSON.stringify(error), { status: 500 });
  }
}
