## Getting Started

First, before you run the development server:

```bash
# install dependencies
npm install

#run server
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

## setup environmental variables

replace the env.example file and its variables with your .env file and your variables.

## Learn more

The home page [http://localhost:3000] generate response based on safety using OpenAI model with chat history.

The retriever page [http://localhost:3000/retriever] generate response based on the content of the documents referenced in your project using OpenAI model.

## add documents

create a folder for your documents, add pdf or csv files into the created folder. The files added will be referenced to in the [/api/chat/retriever] route to enable the model generate response fron the content of the documents with chat history.
