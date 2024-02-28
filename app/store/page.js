"use client";

import axios from "axios";
import { useState } from "react";

export default function Retriever() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Create a new message object with the input content
    const newMessage = {
      content: input,
      role: "user",
    };

    // Add the new message to the messages state
    setMessages((prev) => [...prev, newMessage]);
    setInput("");

    // Send the messages array to the API
    setIsLoading(true);
    const response = await axios.post("/api/chat/store", {
      newMessage,
    });

    setMessages((prev) => [
      ...prev,
      { content: response.data, role: "system" },
    ]);
    setIsLoading(false);
    console.log("response.data", response.data);
  };

  console.log("messages", messages);

  return (
    <div className="flex flex-col gap-2 justify-center items-center h-lvh px-10">
      <div className="text-white flex flex-col gap-1">
        {messages &&
          messages.map((message) =>
            message.role === "user" ? (
              <p className="p-2 bg-blue-500">{message.content}</p>
            ) : (
              <p className="p-2 bg-green-500">{message.content}</p>
            )
          )}
        {isLoading && <div>Please wait...</div>}
      </div>
      <form onSubmit={handleSubmit} className="flex">
        <input
          placeholder="Ask about socially responsible shopping choices "
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="text-black"
        />
        <button className="px-2 py-1 ml-2 bg-green-400 rounded-lg">send</button>
      </form>
    </div>
  );
}
