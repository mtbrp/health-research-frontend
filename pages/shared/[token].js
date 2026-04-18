import { useState, useEffect } from "react";
import axios from "axios";

export default function SharedView({ token }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const backend = process.env.NEXT_PUBLIC_BACKEND;

  useEffect(() => {
    axios.get(`${backend}/shared/${token}`)
      .then(res => {
        if (res.data.error) {
          setError(res.data.error);
        } else {
          setSession(res.data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Share link not found or expired");
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2">📚</div>
          <p className="text-gray-600 dark:text-gray-400">Loading shared conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold dark:text-white mb-2">Link Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 mb-6 shadow-sm border border-gray-200 dark:border-gray-800">
          <h1 className="text-2xl font-bold dark:text-white mb-2">📚 Shared Conversation</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Folder: <span className="text-emerald-600 dark:text-emerald-400 font-medium">{session.folder}</span>
          </p>
          <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
            Created: {new Date(session.created_at).toLocaleString()}
          </p>
        </div>

        <div className="space-y-4">
          {session.messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                msg.role === "user" 
                  ? "bg-emerald-600 text-white" 
                  : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 dark:text-white shadow-sm"
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
          ))}
        </div>

        <div className="text-center text-gray-400 text-sm mt-8 pt-4 border-t border-gray-200 dark:border-gray-800">
          Shared from Health Research Brain
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps({ params }) {
  return {
    props: {
      token: params.token
    }
  };
}