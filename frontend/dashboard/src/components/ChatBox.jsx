import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import api from '../utils/api';

const socket = io(import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000');

const ChatBox = ({ orderId, userId }) => {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socket.emit('join-order-room', orderId);
    api.get(`/chat/${orderId}`).then(res => setMessages(res.data));
    
    socket.on('new-message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    
    return () => socket.off('new-message');
  }, [orderId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    socket.emit('send-message', { orderId, senderId: userId, message: newMsg });
    setNewMsg('');
  };

  return (
    <div className="chat-box">
      <div className="messages-container">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.sender_id === userId ? 'own' : 'other'}`}>
            <span className="sender">{msg.sender_name || 'مستخدم'}</span>
            <p>{msg.message}</p>
            <span className="time">{new Date(msg.sent_at).toLocaleTimeString('ar-LY')}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="chat-input">
        <input value={newMsg} onChange={e => setNewMsg(e.target.value)} placeholder="اكتب رسالتك هنا..." />
        <button type="submit">إرسال</button>
      </form>
    </div>
  );
};

export default ChatBox;