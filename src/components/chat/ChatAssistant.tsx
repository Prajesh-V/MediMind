'use client';

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import styles from './ChatAssistant.module.css';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export function ChatAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, errorMsg]);

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: content.trim() };
    const updatedMessages = [...messages, userMessage];
    
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);
    setErrorMsg(null);

    // Resize textarea back to default
    if (inputRef.current) {
      inputRef.current.style.height = '48px';
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!res.ok) {
        throw new Error('API route returned error status');
      }

      const data = await res.json();

      if (data.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        // API handled the error gracefully but returned success: false
        setErrorMsg('Sorry, the assistant is temporarily unavailable. Please try again.');
      }
    } catch (error) {
      console.error('[ChatAssistant] API Request failed:', error);
      setErrorMsg('Sorry, the assistant is temporarily unavailable. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputValue);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = '48px';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleRetry = () => {
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      const lastUserMsg = messages[messages.length - 1].content;
      const newMessages = messages.slice(0, -1);
      setMessages(newMessages);
      handleSend(lastUserMsg);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.introMessage}>
            <p>Hi! I can help you understand your medications, doses, food history, and safety information.</p>
            <div className={styles.suggestedPrompts}>
              <button className={styles.suggestedPromptBtn} onClick={() => handleSend("What medications am I currently taking?")}>
                What medications am I currently taking?
              </button>
              <button className={styles.suggestedPromptBtn} onClick={() => handleSend("Have I missed any doses recently?")}>
                Have I missed any doses recently?
              </button>
              <button className={styles.suggestedPromptBtn} onClick={() => handleSend("Are there any food interactions I should know about?")}>
                Are there any food interactions I should know about?
              </button>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          msg.role !== 'system' && msg.role !== 'tool' && (
            <div
              key={idx}
              className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
            >
              {msg.content}
            </div>
          )
        ))}

        {isLoading && (
          <div className={styles.loadingIndicator} aria-label="Assistant is thinking">
            <div className={styles.loadingDot}></div>
            <div className={styles.loadingDot}></div>
            <div className={styles.loadingDot}></div>
          </div>
        )}

        {errorMsg && (
          <div className={styles.errorState}>
            {errorMsg}
            <br />
            <button className={styles.retryBtn} onClick={handleRetry}>Retry</button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.inputField}
          value={inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your medications or interactions..."
          disabled={isLoading}
          rows={1}
          aria-label="Chat input"
        />
        <button
          className={styles.sendBtn}
          onClick={() => handleSend(inputValue)}
          disabled={!inputValue.trim() || isLoading}
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </div>
  );
}
