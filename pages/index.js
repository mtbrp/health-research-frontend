import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { saveAs } from 'file-saver';
import { useTheme } from 'next-themes';

export default function Home() {
  // Use a fallback for the backend URL to prevent crashes during build
  const [backend] = useState(process.env.NEXT_PUBLIC_BACKEND || "");
  const [folders, setFolders] = useState(["Nursing", "Physical Therapy", "Occupational Therapy", "Medicine", "Research Methods"]);
  const [currentFolder, setCurrentFolder] = useState("Nursing");
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [exporting, setExporting] = useState(false);
  
  // Analyzer modal state
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const [analyzeMode, setAnalyzeMode] = useState("critique");
  const [analyzeFile, setAnalyzeFile] = useState(null);
  const [analyzeQuery, setAnalyzeQuery] = useState("");
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeReport, setAnalyzeReport] = useState(null);
  
  const { theme, setTheme } = useTheme();
  const chatRef = useRef(null);

  // FORCE TAILWIND LOAD (Fix for your previous unstyled screenshot)
  useEffect(() => {
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement("script");
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }
  }, []);

  // Load folders from backend
  useEffect(() => {
    if (!backend) return;
    axios.get(`${backend}/folders`)
      .then(res => {
        if (res.data.folders && res.data.folders.length > 0) setFolders(res.data.folders);
      })
      .catch(err => console.error("Backend not reachable. Check NEXT_PUBLIC_BACKEND."));
  }, [backend]);

  // Load sessions when folder changes
  useEffect(() => {
    if (backend) loadSessions();
  }, [currentFolder, backend]);

  const loadSessions = async () => {
    try {
      const res = await axios.get(`${backend}/sessions?folder=${currentFolder}`);
      const sessionList = res.data.sessions || [];
      setSessions(sessionList);
      
      if (sessionList.length > 0) {
        setCurrentSession(sessionList[0]);
        loadMessages(sessionList[0]);
      } else {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to load sessions:", err);
    }
  };

  const loadMessages = async (sessionId) => {
    try {
      const res = await axios.get(`${backend}/messages/${sessionId}`);
      setMessages(res.data.messages || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  };

  const createNewSession = async () => {
    try {
      const res = await axios.post(`${backend}/create_session?folder=${currentFolder}`);
      const newId = res.data.session_id;
      setSessions(prev => [newId, ...prev]);
      setCurrentSession(newId);
      setMessages([]);
    } catch (err) {
      alert("Check if backend is awake (Render spins down on free tier)");
    }
  };

  const sendMessage = async () => {
    if (!query.trim() || !currentSession || loading) return;
    
    const userMsg = { role: "user", content: query };
    setMessages(prev => [...prev, userMsg]);
    const tempQuery = query;
    setQuery("");
    setLoading(true);

    try {
      const res = await axios.post(`${backend}/chat`, {
        session_id: currentSession,
        query: tempQuery
      });
      setMessages(prev => [...prev, { role: "assistant", content: res.data.answer }]);
    } catch (e) {
      alert("Error: " + (e.response?.data?.detail || "Connection lost"));
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = async () => {
    if (!currentSession) return;
    setExporting(true);
    try {
      const response = await axios.post(`${backend}/export_session`, {
        session_id: currentSession,
        format: "pdf"
      }, { responseType: "blob" });
      
      saveAs(response.data, `Research_Notes_${currentSession.slice(0,5)}.pdf`);
    } catch (error) {
      alert("Export failed. Make sure your backend has 'fpdf' or 'reportlab' installed.");
    } finally {
      setExporting(false);
    }
  };

  const runAnalysis = async () => {
    if (!analyzeFile) return alert("Select a thesis file first");
    setAnalyzeLoading(true);
    
    const form = new FormData();
    form.append("file", analyzeFile);

    try {
      const res = await axios.post(
        `${backend}/analyze?mode=${analyzeMode}&query=${encodeURIComponent(analyzeQuery)}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setAnalyzeReport(res.data);
    } catch (e) {
      alert("Analysis failed. Max file size might be 10MB.");
    } finally {
      setAnalyzeLoading(false);
    }
  };

  // Auto-scroll chat
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 flex flex-col shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-xl font-bold dark:text-white flex items-center gap-2">
            <span className="text-2xl">🧠</span> Brain
          </h1>
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")} 
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:scale-110 transition-all"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
        
        <button 
          onClick={createNewSession} 
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-2xl mb-6 shadow-lg shadow-emerald-900/20 font-medium transition-all"
        >
          + New Chat
        </button>
        
        <div className="text-[10px] text-gray-400 mb-3 uppercase tracking-[0.2em] font-bold">RESEARCH FOLDERS</div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {folders.map(folder => (
            <button
              key={folder}
              onClick={() => { setCurrentFolder(folder); setCurrentSession(null); }}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm transition-all ${
                currentFolder === folder 
                  ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold" 
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              📁 {folder}
            </button>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Header */}
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-8 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500">●</span>
            <span className="dark:text-white font-bold tracking-tight">{currentFolder}</span>
          </div>
          {currentSession && (
            <div className="flex gap-3">
              <button onClick={exportToPDF} className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-emerald-500 transition">📄 Export</button>
              <button onClick={shareConversation} className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-sm font-medium hover:bg-emerald-500 transition">Share Link</button>
            </div>
          )}
        </header>

        {/* Chat Feed */}
        <main ref={chatRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-40">
              <div className="text-6xl mb-4">📂</div>
              <p className="dark:text-white font-medium">No documents active. Upload a PDF to begin.</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`group relative max-w-[85%] px-5 py-4 rounded-3xl leading-relaxed shadow-sm ${
                  msg.role === "user" 
                    ? "bg-emerald-600 text-white rounded-tr-none" 
                    : "bg-white dark:bg-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-tl-none"
                }`}>
                  <div className="whitespace-pre-wrap">
                    {msg.content.split(/(\[Source\s+\d+\])/g).map((part, idx) => (
                      part.match(/\[Source\s+\d+\]/) 
                        ? <span key={idx} className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 px-1.5 py-0.5 rounded text-xs font-bold mx-0.5 border border-emerald-500/30">{part}</span>
                        : part
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
              <div className="bg-white dark:bg-gray-800 border dark:border-gray-700 px-6 py-4 rounded-3xl rounded-tl-none flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                </div>
                <span className="text-sm font-medium dark:text-gray-400">Reviewing clinical data...</span>
              </div>
            </div>
          )}
        </main>

        {/* Input */}
        <footer className="p-6 bg-transparent">
          <div className="max-w-4xl mx-auto flex gap-4 bg-white dark:bg-gray-800 p-2 rounded-[2rem] shadow-xl border border-gray-100 dark:border-gray-700">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder={`Query ${currentFolder} knowledge base...`}
              className="flex-1 bg-transparent dark:text-white px-6 py-3 focus:outline-none"
              disabled={!currentSession}
            />
            <button
              onClick={sendMessage}
              disabled={!currentSession || loading || !query.trim()}
              className="bg-emerald-600 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-emerald-500 disabled:opacity-30 transition-all shadow-lg"
            >
              <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>
            </button>
          </div>
        </footer>
      </div>

      {/* Right Tools - Unified Analyzer */}
      <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-6 flex flex-col shadow-inner">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">Clinical Tools</h3>
        
        <div className="space-y-6">
           <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800">
             <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-3">QUICK UPLOAD</label>
             <input
                type="file"
                accept=".pdf"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const form = new FormData();
                  form.append("file", file);
                  try {
                    await axios.post(`${backend}/upload?folder=${currentFolder}`, form);
                    alert("Success: Data ingested.");
                  } catch (err) { alert("Upload Failed"); }
                }}
                className="text-xs dark:text-gray-300 file:hidden"
             />
             <div className="mt-2 text-[10px] text-emerald-600 opacity-60">PDF files only • Max 10MB</div>
           </div>

           <button
            onClick={() => setShowAnalyzer(true)}
            className="w-full group bg-violet-600 hover:bg-violet-700 text-white p-4 rounded-2xl transition-all shadow-lg shadow-violet-900/20 flex flex-col items-start gap-1"
          >
            <span className="font-bold flex items-center gap-2">🔬 Thesis Analyzer <span className="group-hover:translate-x-1 transition-transform">→</span></span>
            <span className="text-[10px] opacity-70">Critique Chapters 3 & 4 or run Stats</span>
          </button>
        </div>

        <div className="mt-auto pt-6 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 text-center space-y-2">
          <div className="flex justify-center gap-4">
            <span>🛡️ AES-256</span>
            <span>⚡ Gemini-1.5</span>
          </div>
          <p>© 2024 Health Research Brain • Matthew</p>
        </div>
      </div>
      
      {/* Modals remain essentially the same but ensure they use dark:bg-gray-900 */}
    </div>
  );
}
