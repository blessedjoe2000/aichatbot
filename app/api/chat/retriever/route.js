import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";

async function loadAndStoreDocuments() {
  //pdf documents loaded
  const pdfBookPath =
    "/Users/joetalker/Desktop/masterschool/projects/langchain/documents/The_Better_World_Shopping_Guide_6th_Edit.pdf";
  const pdfLoader = new PDFLoader(pdfBookPath);
  const pdfDocs = await pdfLoader.load();

  //CSV documents loader
  const csvBookPath =
    "/Users/joetalker/Desktop/masterschool/projects/langchain/documents/Research.Spreadsheet.-.Corporate.Knights.csv";
  const csvLoader = new CSVLoader(csvBookPath);
  const csvDocs = await csvLoader.load();

  //combine pdf and csv documents
  const allDocs = [...pdfDocs, ...csvDocs];

  const splitter = new RecursiveCharacterTextSplitter();
  const splitDocs = await splitter.splitDocuments(allDocs);

  const embeddings = new OpenAIEmbeddings();

  const vectStoStartTime = Date.now();
  //Declear vectorstore
  const vectorstore = await MemoryVectorStore.fromDocuments(
    splitDocs,
    embeddings
  );

  const vectStoEndTime = Date.now();
  const vectStoElapsedTime = (vectStoEndTime - vectStoStartTime) / 1000;

  console.log("Time take for vector store:", vectStoElapsedTime, "seconds");

  return vectorstore;
}

const vectorstorePromise = loadAndStoreDocuments().then((vectorstore) => {
  // Declear openAI model
  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.5,
  });

  //create chat prompt for the model
  const prompt = ChatPromptTemplate.fromTemplate(
    `You're a chat bot name BetterBot, for a company called Better World. You are to Answer the question based only on the following context and chat history:

  If you do not know the answer, please respond with apologies, can you elaborate better to make me understand your query. Do not respond with "based on the context provided", do not respond like you were given a context, respond like you are independent. Make response detailed and concised.

  
  <context>
    {context}
  </context>.
  
  <chat_history>
    {chat_history}
  </chat_history>

  Question: {input}
  `
  );

  return createStuffDocumentsChain({
    llm: model,
    prompt,
  }).then((documentChain) => {
    return { vectorstore, documentChain };
  });
});

export async function POST(req) {
  const overallStartTime = Date.now();
  try {
    const { messages } = await req.json();
    const input = messages[messages.length - 1].content;

    const chatHistory = messages;

    const { vectorstore, documentChain } = await vectorstorePromise;
    //declear retriever
    const retriever = vectorstore.asRetriever();

    //create retriever chain
    const retrieverChain = await createRetrievalChain({
      combineDocsChain: documentChain,
      retriever,
      chat_history: chatHistory,
    });

    const resultStartTime = Date.now();
    const result = await retrieverChain.invoke({
      input: input,
    });

    const resultEndTime = Date.now();
    const resultElapsedTime = (resultEndTime - resultStartTime) / 1000;

    console.log("Time taken for result:", resultElapsedTime, "seconds");

    const overallEndTime = Date.now();
    const overallElapsedTime = (overallEndTime - overallStartTime) / 1000;
    console.log("Overall runtime:", overallElapsedTime, "seconds");

    return new Response(JSON.stringify(result.answer), {
      status: 200,
    });
  } catch (error) {
    return newResponse(
      JSON.stringify({ error: error.message }, { status: error.status || 500 })
    );
  }
}
