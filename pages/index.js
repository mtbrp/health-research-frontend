import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { saveAs } from 'file-saver';
import { useTheme } from 'next-themes';

export default function Home() {
  const [backend] = useState(process.env.NEXT_PUBLIC_BACKEND);
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

  // Load folders from backend
  useEffect(() => {
    axios.get(`${backend}/folders`).then(res => {
      if (res.data.folders.length > 0) setFolders(res.data.folders);
    }).catch(err => console.error("Backend not reachable:", err));
  }, [backend]);

  // Load sessions when folder changes
  useEffect(() => {
    loadSessions();
  }, [currentFolder]);

  const loadSessions = async () => {
    try {
      const res = await axios.get(`${backend}/sessions?folder=${currentFolder}`);
      setSessions(res.data.sessions || []);
      if (res.data.sessions && res.data.sessions.length > 0) {
        setCurrentSession(res.data.sessions[0]);
        loadMessages(res.data.sessions[0]);
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
      console.error("Failed to create session:", err);
      alert("Error creating new session. Is the backend running?");
    }
  };

  const sendMessage = async () => {
    if (!query.trim() || !currentSession) return;
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
      console.error(e);
      alert("Error: " + (e.response?.data?.detail || e.message));
    }
    setLoading(false);
  };

  const shareConversation = async () => {
    if (!currentSession) {
      alert("No active conversation to share");
      return;
    }
    
    try {
      const res = await axios.post(`${backend}/share_session`, {
        session_id: currentSession
      });
      const fullShareUrl = `${window.location.origin}/shared/${res.data.share_token}`;
      setShareLink(fullShareUrl);
      setShareModalOpen(true);
      await navigator.clipboard.writeText(fullShareUrl);
      alert("Share link copied to clipboard!");
    } catch (error) {
      console.error("Share failed:", error);
      alert("Failed to create share link");
    }
  };

  const exportToPDF = async () => {
    if (!currentSession) {
      alert("No conversation to export");
      return;
    }
    
    setExporting(true);
    try {
      const response = await axios.post(`${backend}/export_session`, {
        session_id: currentSession,
        format: "pdf"
      }, {
        responseType: "blob"
      });
      
      const blob = new Blob([response.data], { type: "application/pdf" });
      saveAs(blob, `chat_export_${currentSession.slice(0,8)}.pdf`);
      alert("PDF exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export PDF");
    }
    setExporting(false);
  };

  // New Analyze function
  const runAnalysis = async () => {
    if (!analyzeFile) {
      alert("Please select a file");
      return;
    }
    setAnalyzeLoading(true);
    setAnalyzeReport(null);

    const form = new FormData();
    form.append("file", analyzeFile);

    try {
      const res = await axios.post(
        `${backend}/analyze?mode=${analyzeMode}${analyzeQuery ? `&query=${encodeURIComponent(analyzeQuery)}` : ""}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setAnalyzeReport(res.data);
    } catch (e) {
      alert("Analysis failed. Check console.");
      console.error(e);
    }
    setAnalyzeLoading(false);
  };

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-bold dark:text-white">🧠 Health Research</h1>
          <button 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")} 
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
        
        <button 
          onClick={createNewSession} 
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl mb-4 transition"
        >
          + New Chat in {currentFolder}
        </button>
        
        <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider">FOLDERS</div>
        {folders.map(folder => (
          <button
            key={folder}
            onClick={() => {
              setCurrentFolder(folder);
              setCurrentSession(null);
              setMessages([]);
            }}
            className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-sm transition ${
              currentFolder === folder 
                ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" 
                : "hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-300"
            }`}
          >
            📁 {folder}
          </button>
        ))}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 bg-white dark:bg-gray-900">
          <span className="dark:text-white font-medium">📁 {currentFolder}</span>
          {currentSession && (
            <div className="flex gap-2">
              <button 
                onClick={shareConversation} 
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition"
              >
                🔗 Share
              </button>
              <button 
                onClick={exportToPDF} 
                disabled={exporting}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm transition disabled:opacity-50"
              >
                {exporting ? "📄 Exporting..." : "📄 Export PDF"}
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={chatRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {!currentSession ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-2xl font-semibold dark:text-white mb-2">Welcome to your Research Brain</h2>
              <p className="text-gray-500 dark:text-gray-400">Click "New Chat" to start asking questions about your documents</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-20">
              💡 Ask a question about {currentFolder}
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                  msg.role === "user" 
                    ? "bg-emerald-600 text-white" 
                    : "bg-gray-200 dark:bg-gray-800 dark:text-white"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="whitespace-pre-wrap">
                      {msg.content.split(/(\[Source\s+\d+\])/g).map((part, idx) => {
                        if (part.match(/\[Source\s+\d+\]/)) {
                          return <span key={idx} className="bg-yellow-500/30 dark:bg-yellow-500/40 px-1 rounded font-mono text-sm">{part}</span>;
                        }
                        return <span key={idx}>{part}</span>;
                      })}
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-200 dark:bg-gray-800 px-4 py-3 rounded-2xl dark:text-white">
                <div className="flex gap-1">
                  <span className="animate-pulse">🧠</span>
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask about your documents..."
              className="flex-1 bg-gray-100 dark:bg-gray-800 dark:text-white rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={!currentSession}
            />
            <button
              onClick={sendMessage}
              disabled={!currentSession || loading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 rounded-2xl transition disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Upload + Thesis Analyzer */}
      <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-4 flex flex-col">
        <div className="mb-6">
          <label className="block text-xs text-gray-400 mb-2 uppercase tracking-wider">
            Upload PDF to {currentFolder}
          </label>
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
                alert(`✅ "${file.name}" uploaded to ${currentFolder}`);
              } catch (err) {
                alert("❌ Upload failed: " + (err.response?.data?.detail || err.message));
              }
            }}
            className="block w-full text-sm text-gray-500 dark:text-gray-400
              file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0
              file:bg-emerald-50 dark:file:bg-emerald-900/30 
              file:text-emerald-700 dark:file:text-emerald-300
              hover:file:bg-emerald-100 dark:hover:file:bg-emerald-900/50"
          />
        </div>

        {/* NEW THESIS ANALYZER BUTTON */}
        <button
          onClick={() => { setShowAnalyzer(true); setAnalyzeReport(null); }}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 mb-4 transition"
        >
          🔬 Analyze Thesis (Ch3/Ch4)
        </button>

        <div className="mt-auto text-xs text-gray-400 text-center pt-4 border-t border-gray-200 dark:border-gray-800">
          🔒 Private & Secure<br />
          Powered by Google Gemini (Free)
        </div>

        {/* THESIS ANALYZER MODAL */}
        {showAnalyzer && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-900 w-full max-w-2xl mx-4 rounded-3xl p-8 max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6 dark:text-white">🔬 Analyze Thesis File</h2>
              
              <div className="mb-6">
                <label className="block text-sm mb-2 dark:text-gray-300">Mode</label>
                <select
                  value={analyzeMode}
                  onChange={(e) => setAnalyzeMode(e.target.value)}
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 dark:text-white"
                >
                  <option value="critique">📝 Critique Thesis Chapter (What went right/wrong/improve)</option>
                  <option value="stats">📊 Statistics Analyzer (Upload CSV/Excel for Ch3 &amp; Ch4)</option>
                </select>
              </div>

              <div className="mb-6">
                <label className="block text-sm mb-2 dark:text-gray-300">Upload File</label>
                <input
                  type="file"
                  accept={analyzeMode === "critique" ? ".pdf" : ".csv,.xlsx,.xls"}
                  onChange={(e) => setAnalyzeFile(e.target.files[0])}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0
                    file:bg-violet-50 dark:file:bg-violet-900/30 
                    file:text-violet-700 dark:file:text-violet-300
                    hover:file:bg-violet-100 dark:hover:file:bg-violet-900/50"
                />
                <p className="text-xs text-gray-400 mt-1">
                  {analyzeMode === "critique" ? "Upload PDF of your thesis chapter" : "Upload CSV or Excel file with your research data"}
                </p>
              </div>

              {analyzeMode === "stats" && (
                <div className="mb-6">
                  <label className="block text-sm mb-2 dark:text-gray-300">Optional Question (e.g., "Run regression on treatment vs outcome")</label>
                  <input
                    value={analyzeQuery}
                    onChange={(e) => setAnalyzeQuery(e.target.value)}
                    placeholder="e.g., Compare control vs treatment group outcomes"
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3 dark:text-white"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAnalyzer(false)}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={runAnalysis}
                  disabled={analyzeLoading || !analyzeFile}
                  className="flex-1 bg-violet-600 hover:bg-violet-500 text-white py-3 rounded-2xl font-medium disabled:opacity-50 transition"
                >
                  {analyzeLoading ? "Analyzing..." : "Run Analysis"}
                </button>
              </div>

              {analyzeReport && (
                <div className="mt-8 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 max-h-96 overflow-y-auto">
                  <h3 className="font-bold mb-3 dark:text-white">
                    {analyzeReport.mode === "critique" ? "📋 Thesis Critique Report" : "📊 Statistics Analysis Report"}
                  </h3>
                  <div className="whitespace-pre-wrap text-sm dark:text-gray-300 leading-relaxed">
                    {analyzeReport.report}
                  </div>
                  {analyzeReport.data_summary && (
                    <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
                      <p className="text-xs text-gray-500">Data preview available in backend logs</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4 dark:text-white">🔗 Share Link Copied!</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-3">Anyone with this link can view this conversation:</p>
            <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg mb-4 break-all">
              <code className="text-sm text-emerald-600 dark:text-emerald-400">{shareLink}</code>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLink);
                  alert("Link copied again!");
                }}
                className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white py-2 rounded-lg transition"
              >
                Copy Again
              </button>
              <button
                onClick={() => setShareModalOpen(false)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}