"use client";

import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleMessagePrompt = async (e) => {
    e.preventDefault();

    const newMessage = { role: "user", content: input };

    setIsLoading(true);
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInput("");

    const response = await axios.post(`/api/chat`, {
      messages: [newMessage],
    });
    setIsLoading(false);

    setMessages((prev) => [
      ...prev,
      { content: response.data, role: "system" },
    ]);
  };

  return (
    <main className="flex flex-col gap-2 justify-center items-center h-lvh px-10">
      <div className="flex flex-col gap-1">
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
      <form onSubmit={handleMessagePrompt}>
        <div className="mb-2">
          <input
            name="message"
            placeholder="what can i do for you?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="text-black px-2"
          />
        </div>
        <button className="px-2 py-1 bg-green-400 rounded-lg">send</button>
      </form>
    </main>
  );
}
