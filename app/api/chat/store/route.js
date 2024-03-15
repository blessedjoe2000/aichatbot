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
    const overallStartTime = Date.now();
    const { newMessage } = await req.json();
    const input = newMessage.content;
    console.log("new message", newMessage);

    const pdfStartTime = Date.now();
    //pdf documents loaded
    const pdfBookPath =
      "/Users/joetalker/Desktop/masterschool/projects/langchain/documents/The_Better_World_Shopping_Guide_6th_Edit.pdf";
    const pdfLoader = new PDFLoader(pdfBookPath);
    const pdfDocs = await pdfLoader.load();
    const pdfEndTime = Date.now();
    const pdfElapsedTime = (pdfEndTime - pdfStartTime) / 1000;
    console.log("Time taken to load PDF documents:", pdfElapsedTime, "seconds");

    const csvStartTime = Date.now();
    //CSV documents loader
    const csvBookPath =
      "/Users/joetalker/Desktop/masterschool/projects/langchain/documents/Research.Spreadsheet.-.Corporate.Knights.csv";
    const csvLoader = new CSVLoader(csvBookPath);
    const csvDocs = await csvLoader.load();
    const csvEndTime = Date.now();
    const csvElapsedTime = (csvEndTime - csvStartTime) / 1000;
    console.log("Time taken to load CSV documents:", csvElapsedTime, "seconds");

    //combine pdf and csv documents
    const allDocs = [...pdfDocs, ...csvDocs];

    const splitterStartTime = Date.now();
    const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
      chunkSize: 250,
      chunkOverlap: 20,
    });
    const splitDocs = await splitter.splitDocuments(allDocs);
    const splitterEndTime = Date.now();
    const splitterElapsedTime = (splitterEndTime - splitterStartTime) / 1000;
    console.log(
      "Time taken to split documents:",
      splitterElapsedTime,
      "seconds"
    );

    const pineconeStartTime = Date.now();
    const pinecone = new Pinecone();
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX);
    const pineconeEndTime = Date.now();
    const pineconeElapsedTime = (pineconeEndTime - pineconeStartTime) / 1000;
    console.log(
      "Time taken to initialize Pinecone:",
      pineconeElapsedTime,
      "seconds"
    );

    const vectorstoreStartTime = Date.now();
    console.log("here up");
    const vectorstore = await PineconeStore.fromDocuments(
      splitDocs,
      new OpenAIEmbeddings(),
      {
        pineconeIndex,
      }
    );
    console.log("Here down");
    const vectorstoreEndTime = Date.now();
    const vectorstoreElapsedTime =
      (vectorstoreEndTime - vectorstoreStartTime) / 1000;
    console.log(
      "Time taken to create PineconeStore:",
      vectorstoreElapsedTime,
      "seconds"
    );

    const modelStartTime = Date.now();
    const model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.5,
    });
    const modelEndTime = Date.now();
    const modelElapsedTime = (modelEndTime - modelStartTime) / 1000;
    console.log("Time taken to create model:", modelElapsedTime, "seconds");

    const promptStartTime = Date.now();
    const prompt = ChatPromptTemplate.fromTemplate(
      `You're a chat bot name BetterBot, for a company called Better World. You are to answer the following question based only on the provided context:
      <context>
        {context}
      </context>.
      
      If you do not know the answer, please respond with apologies, can you elaborate better to make me understand your query. Do not respond with based on the context provided, do not respond like you were given a context, respond like you are independent. Make response detailed and concised.

      Question: {input}
      `
    );
    const promptEndTime = Date.now();
    const promptElapsedTime = (promptEndTime - promptStartTime) / 1000;
    console.log("Time taken for prompt:", promptElapsedTime, "seconds");

    const docChainStartTime = Date.now();
    const documentChain = await createStuffDocumentsChain({
      llm: model,
      prompt,
    });
    const docChainEndTime = Date.now();
    const docChainElapsedTime = (docChainEndTime - docChainStartTime) / 1000;
    console.log(
      "Time taken for document chain:",
      docChainElapsedTime,
      "seconds"
    );

    const retrieverStartTime = Date.now();
    const retriever = vectorstore.asRetriever();
    const retrieverEndTime = Date.now();
    const retrieverElapsedTime = (retrieverEndTime - retrieverStartTime) / 1000;
    console.log("Time taken for retriever:", retrieverElapsedTime, "seconds");

    const retChainStartTime = Date.now();
    const retrieverChain = await createRetrievalChain({
      combineDocsChain: documentChain,
      retriever,
    });
    const retChainEndTime = Date.now();
    const retChainELapsedTime = (retChainEndTime - retChainStartTime) / 1000;
    console.log(
      "Time taken for retriever chain:",
      retChainELapsedTime,
      "seconds"
    );

    const resultStartTime = Date.now();
    const result = await retrieverChain.invoke({
      input: input,
    });
    const resultEndTime = Date.now();
    const resultElapsedTime = (resultEndTime - resultStartTime) / 1000;
    console.log("Time taken for result:", resultElapsedTime, "seconds");

    const histPromptStartTime = Date.now();
    const historyAwarePrompt = ChatPromptTemplate.fromMessages([
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
      [
        "user",
        "Given the above conversation, generate a search query to look up in order to get information relevant to the conversation",
      ],
    ]);
    const histPromptEndTime = Date.now();
    const histPromptElapsedTime =
      (histPromptEndTime - histPromptStartTime) / 1000;
    console.log(
      "Time taken for history prompt:",
      histPromptElapsedTime,
      "seconds"
    );

    const histRetChainStartTime = Date.now();
    const historyAwareRetrieverChain = await createHistoryAwareRetriever({
      llm: model,
      retriever,
      rephrasePrompt: historyAwarePrompt,
    });
    const histRetChainEndTime = Date.now();
    const histRetChainElapsedTime =
      (histRetChainEndTime - histRetChainStartTime) / 1000;
    console.log(
      "Time taken history retriever chain:",
      histRetChainElapsedTime,
      "seconds"
    );

    const chatHistStartTime = Date.now();
    const chatHistory = [new HumanMessage(input), new AIMessage(result.answer)];
    const chatHistEndTime = Date.now();
    const chatHistElapsedTime = (chatHistEndTime - chatHistStartTime) / 1000;
    console.log("Time taken for chat history:", chatHistElapsedTime, "seconds");

    const histRetPromptStartTime = Date.now();
    const historyAwareRetrieverPrompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        "Answer the user's questions based on the below context: \n\n {context}",
      ],
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
    ]);
    const histRetPromptEndTime = Date.now();
    const histRetPromptElapsedTime =
      (histRetPromptEndTime - histRetPromptStartTime) / 1000;
    console.log(
      "Time taken for history retriever prompt:",
      histRetPromptElapsedTime,
      "seconds"
    );

    const histDocChainStartTime = Date.now();
    const historyAwareCombineDocsChain = await createStuffDocumentsChain({
      llm: model,
      prompt: historyAwareRetrieverPrompt,
    });
    const histDocChainEndTime = Date.now();
    const histDocChainElapsedTime =
      (histDocChainEndTime - histDocChainStartTime) / 1000;
    console.log(
      "Time taken for history document chain:",
      histDocChainElapsedTime,
      "seconds"
    );

    const conRetChainStartTime = Date.now();
    const conversationalRetrievalChain = await createRetrievalChain({
      retriever: historyAwareRetrieverChain,
      combineDocsChain: historyAwareCombineDocsChain,
    });
    const conRetChainEndTime = Date.now();
    const conRetChainElapsedTime =
      (conRetChainEndTime - conRetChainStartTime) / 1000;
    console.log(
      "Time taken for conversational retriever chain:",
      conRetChainElapsedTime,
      "seconds"
    );

    const convResultStartTime = Date.now();
    const conversationalResult = await conversationalRetrievalChain.invoke({
      chat_history: chatHistory,
      input: input,
    });
    const convResultEndTime = Date.now();
    const convResultElapsedTime =
      (convResultEndTime - convResultStartTime) / 1000;
    console.log(
      "Time taken for conversational result:",
      convResultElapsedTime,
      "seconds"
    );

    const overallEndTime = Date.now();
    const overallElapsedTime = (overallEndTime - overallStartTime) / 1000;
    console.log("Overall runtime:", overallElapsedTime, "seconds");

    return new Response(JSON.stringify(conversationalResult.answer), {
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      statue: 500,
    });
  }
}
