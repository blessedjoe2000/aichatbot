import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone } from "@pinecone-database/pinecone";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";

export async function POST(req) {
  try {
    const { newMessage } = await req.json();
    const input = newMessage.content;

    //pdf documents loaded
    const pdfBookPath = "your pdf file path";
    const pdfLoader = new PDFLoader(pdfBookPath);
    const pdfDocs = await pdfLoader.load();

    //CSV documents loader
    const csvBookPath = "your csv file path";
    const csvLoader = new CSVLoader(csvBookPath);
    const csvDocs = await csvLoader.load();

    //combine pdf and csv documents
    const allDocs = [...pdfDocs, ...csvDocs];

    const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
      chunkSize: 250,
      chunkOverlap: 20,
    });
    const splitDocs = await splitter.splitDocuments(allDocs);

    const pinecone = new Pinecone();
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);

    const vectorstore = await PineconeStore.fromDocuments(
      splitDocs,
      new OpenAIEmbeddings(),
      {
        pineconeIndex,
      }
    );

    const model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.5,
    });

    const prompt = ChatPromptTemplate.fromTemplate(
      `You're a chat bot name BetterBot, for a company called Better World. You are to answer the following question based only on the provided context:
      <context>
        {context}
      </context>.
      
      If you do not know the answer, please respond with apologies, can you elaborate better to make me understand your query. Do not respond with based on the context provided, do not respond like you were given a context, respond like you are independent

      Question: {input}
      `
    );

    const documentChain = await createStuffDocumentsChain({
      llm: model,
      prompt,
    });

    const retriever = vectorstore.asRetriever();

    const retrieverChain = await createRetrievalChain({
      combineDocsChain: documentChain,
      retriever,
    });

    const result = await retrieverChain.invoke({
      input: input,
    });

    const historyAwarePrompt = ChatPromptTemplate.fromMessages([
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
      [
        "user",
        "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation",
      ],
    ]);

    const historyAwareRetrieverChain = await createHistoryAwareRetriever({
      llm: model,
      retriever,
      rephrasePrompt: historyAwarePrompt,
    });

    const chatHistory = [new HumanMessage(input), new AIMessage(result.answer)];

    const historyAwareRetrieverPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "Answer the user's questions based on the below context: \n\n {context}",
      ],
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
    ]);

    const historyAwareCombineDocsChain = await createStuffDocumentsChain({
      llm: model,
      prompt: historyAwareRetrieverPrompt,
    });

    const conversationalRetrievalChain = await createRetrievalChain({
      retriever: historyAwareRetrieverChain,
      combineDocsChain: historyAwareCombineDocsChain,
    });

    const conversationalResult = await conversationalRetrievalChain.invoke({
      chat_history: chatHistory,
      input: input,
    });

    return new Response(JSON.stringify(conversationalResult.answer), {
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      statue: 500,
    });
  }
}
