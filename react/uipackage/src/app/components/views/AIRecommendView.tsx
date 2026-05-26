import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, User, Send } from 'lucide-react';
import { usePlayer } from '../../contexts/PlayerContext';

function renderMarkdown(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-white/5 rounded-lg p-3 my-2 overflow-x-auto text-xs"><code>$1</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1.5 py-0.5 rounded text-xs">$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-3 mb-1">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-3 mb-1">$1</h1>');
  html = html.replace(/^[-*] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');
  html = html.replace(/\n/g, '<br>');
  html = html.replace(/<br><li/g, '<li');
  html = html.replace(/<\/li><br>/g, '</li>');
  return html;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

interface LyricLine {
  text: string;
  time: number;
}

export default function AIRecommendView() {
  const { currentTime } = usePlayer();
  const [messages, setMessages] = useState<Message[]>([]);

  const [inputValue, setInputValue] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLDivElement>(null);

  const lyrics: LyricLine[] = [
    { text: 'In the beginning there was silence', time: 0 },
    { text: 'Then came the sound of distant notes', time: 20 },
    { text: 'Piano keys dancing in the dark', time: 40 },
    { text: 'Under the moonlight so serene', time: 60 },
    { text: 'The gentle keys are playing...', time: 80 },
    { text: 'Melodies float through the air', time: 100 },
    { text: 'Saxophone whispers through the night', time: 120 },
    { text: 'A melody so enchanting', time: 140 },
    { text: 'Hearts begin to sway and move', time: 160 },
    { text: 'Stars are dancing in the sky', time: 180 },
    { text: 'Jazz fills the midnight hour', time: 200 },
    { text: 'Smooth rhythms carry us away', time: 220 },
    { text: 'In this moment we are free', time: 240 },
    { text: 'Lost in the music forever', time: 260 },
    { text: 'Until the dawn breaks again', time: 280 },
  ];

  const activeLyricIndex = lyrics.findIndex((lyric, index) => {
    const nextLyric = lyrics[index + 1];
    return currentTime >= lyric.time && (!nextLyric || currentTime < nextLyric.time);
  });

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  // Auto-scroll lyrics to active line
  useEffect(() => {
    if (activeLyricRef.current && lyricsContainerRef.current) {
      const container = lyricsContainerRef.current;
      const activeLine = activeLyricRef.current;

      const containerHeight = container.clientHeight;
      const lineOffsetTop = activeLine.offsetTop;
      const lineHeight = activeLine.clientHeight;

      // Scroll so active lyric is centered
      const scrollTo = lineOffsetTop - containerHeight / 2 + lineHeight / 2;

      container.scrollTo({
        top: scrollTo,
        behavior: 'smooth',
      });
    }
  }, [activeLyricIndex]);

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInputValue('');

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Okay, let me recommend music that fits your mood...',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 1000);
  };

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden text-white">
      {/* Left: Chat & Album */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Chat Messages */}
        <div className="flex-1 bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6 flex flex-col overflow-hidden">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 flex-shrink-0">
            <Bot className="w-6 h-6 text-purple-400" />
            AI Music Assistant
          </h2>

          <div ref={chatContainerRef} className="flex-1 overflow-auto space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : ''}`}
                >
                  {message.type === 'ai' && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                  )}

                  <div
                    className={`max-w-[70%] p-4 rounded-2xl ${
                      message.type === 'user'
                        ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-line" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
                    <p className="text-xs text-gray-500 mt-2">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {message.type === 'user' && (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Input */}
          <div className="mt-6 flex gap-3 flex-shrink-0">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Tell me your mood or music preference..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-purple-500/50 transition-colors"
            />
            <button
              onClick={handleSendMessage}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>

        {/* Album Cover */}
        <div className="h-64 bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6 flex items-center gap-6">
          <div className="w-44 h-44 rounded-xl overflow-hidden shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop"
              alt="Midnight Jazz"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">Midnight Jazz</h3>
            <p className="text-gray-400 mb-4">Smooth Jazz Ensemble</p>
            <div className="flex gap-2 text-sm text-gray-500">
              <span>2024</span>
              <span>•</span>
              <span>12 tracks</span>
              <span>•</span>
              <span>Jazz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Synchronized Lyrics */}
      <div className="w-96 bg-gradient-to-br from-[#1a1a2e]/80 to-[#12121a]/80 backdrop-blur-xl rounded-2xl border border-white/10 p-6 flex flex-col">
        <h3 className="text-lg font-semibold mb-6">Lyrics</h3>

        <div
          ref={lyricsContainerRef}
          className="flex-1 flex flex-col justify-start items-center gap-8 overflow-auto py-32"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {lyrics.map((lyric, index) => (
            <motion.div
              key={index}
              ref={index === activeLyricIndex ? activeLyricRef : null}
              animate={{
                scale: index === activeLyricIndex ? 1.15 : 0.85,
                opacity: index === activeLyricIndex ? 1 : 0.35,
              }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className={`text-center transition-all whitespace-nowrap ${
                index === activeLyricIndex
                  ? 'text-2xl font-semibold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent'
                  : 'text-base text-gray-400'
              }`}
            >
              {lyric.text}
            </motion.div>
          ))}
        </div>
        <style jsx>{`
          div::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        <div className="mt-6 pt-6 border-t border-white/10">
          <div className="text-sm text-gray-500 text-center">
            Playing from <span className="text-purple-400">AI Recommendations</span>
          </div>
        </div>
      </div>
    </div>
  );
}
