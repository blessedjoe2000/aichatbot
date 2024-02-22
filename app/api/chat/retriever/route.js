import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { CSVLoader } from "langchain/document_loaders/fs/csv";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

export async function POST(req) {
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

  try {
    // Declear openAI model
    const model = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0.5,
    });

    const splitter = new RecursiveCharacterTextSplitter();
    const splitDocs = await splitter.splitDocuments(allDocs);

    const embeddings = new OpenAIEmbeddings();

    //Declear vectorstore
    const vectorstore = await MemoryVectorStore.fromDocuments(
      splitDocs,
      embeddings
    );

    //create chat prompt for the model
    const prompt = ChatPromptTemplate.fromTemplate(
      `You're a chat bot name BetterBot, for a company called Better World. You are to answer the following question based only on the provided context:
      <context>
        {context}
      </context>

      Question: {input}
      `
    );

    //create document chain
    const documentChain = await createStuffDocumentsChain({
      llm: model,
      prompt,
    });

    //declear retriever
    const retriever = vectorstore.asRetriever();

    //create retriever chain
    const retrieverChain = await createRetrievalChain({
      combineDocsChain: documentChain,
      retriever,
    });

    const result = await retrieverChain.invoke({
      input: input,
    });

    //create chat prompt template with chat history
    const historyAwarePrompt = ChatPromptTemplate.fromMessages([
      new MessagesPlaceholder("chat_history"),
      ["user", "{input}"],
      [
        "user",
        "Given the above conversation, generate a seeach query to look up in order to get information relevant to the conversation",
      ],
    ]);

    const historyAwareRetrieverChain = await createHistoryAwareRetriever({
      llm: model,
      retriever,
      rephrasePrompt: historyAwarePrompt,
    });

    const chatHistory = [new HumanMessage(input), new AIMessage(result.answer)];

    await historyAwareRetrieverChain.invoke({
      chat_history: chatHistory,
      input: input,
    });

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
      chat_history: [new HumanMessage(input), new AIMessage(result.answer)],
      input: input,
    });

    return new Response(JSON.stringify(conversationalResult.answer), {
      status: 200,
    });
  } catch (error) {
    return newResponse(
      JSON.stringify({ error: error.message }, { status: error.status || 500 })
    );
  }
}
