"use client";

import axios from "axios";
import { useState } from "react";

export default function Retriever() {
  const [input, setInput] = useState("");
  const [message, setMessage] = useState({
    role: "user",
    content: "",
  });
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsLoading(true);
    // Add the new message to the messages state
    setMessages((prev) => [...prev, message]);
    setMessage({ ...message, content: "" });

    //send messages to API
    const response = await axios.post("/api/chat/retriever", {
      messages: [...messages, message],
    });
    //update messages with response from model
    setMessages((prev) => [
      ...prev,
      { role: "system", content: response.data },
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
          value={message.content}
          onChange={(e) =>
            setMessage({ role: "user", content: e.target.value })
          }
          className="text-black"
        />
        <button className="px-2 py-1 ml-2 bg-green-400 rounded-lg">send</button>
      </form>
    </div>
  );
}
