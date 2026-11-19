import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { MarkdownContent } from '../components/chat/MarkdownContent';
import {
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  BookOpen,
  FileText,
  Bookmark,
  Bot,
  User as UserIcon,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Check,
  RefreshCw,
  SlidersHorizontal,
  X,
  Layers,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/chat.service';
import { documentService } from '../services/document.service';
import { VISUALIZATION_TYPES } from '../components/visualization/VisualizationTypeSelector';

export const AIStudyChat = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Conversations State
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [conversationSearch, setConversationSearch] = useState('');
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);

  // Messages State
  const [messages, setMessages] = useState([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState(null);

  // Document Selection & Grounding State
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [isDocDropdownOpen, setIsDocDropdownOpen] = useState(false);

  // Chat Mode & Options
  const [explanationMode, setExplanationMode] = useState('standard'); // 'standard' | 'simple_explanation'
  const [expandedSources, setExpandedSources] = useState({}); // { [messageId]: boolean }
  const [expandedSnippet, setExpandedSnippet] = useState({}); // { [sourceId]: boolean }
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Visualize Answer Modal State
  const [visualizeModalMsg, setVisualizeModalMsg] = useState(null);
  const [visualizeModalType, setVisualizeModalType] = useState('concept_map');
  const [visualizeModalTopic, setVisualizeModalTopic] = useState('');

  const messagesEndRef = useRef(null);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  // Initial load: Fetch conversations and user documents
  useEffect(() => {
    loadConversations();
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const res = await documentService.getDocuments();
      const docs = res?.data || [];
      setDocuments(docs.filter(d => d.processingStatus === 'COMPLETED' || d.processingStatus === 'completed'));
    } catch (err) {
      console.error('Failed to load documents for chat:', err);
    }
  };

  const loadConversations = async () => {
    setIsConversationsLoading(true);
    try {
      const list = await chatService.getConversations();
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        // If query param has conv id, select it; otherwise select most recent
        const params = new URLSearchParams(location.search);
        const urlConvId = params.get('conversation');
        const targetId = urlConvId && list.some(c => c.id === urlConvId) ? urlConvId : list[0].id;
        selectConversation(targetId);
      } else if (list.length === 0) {
        setMessages([getWelcomeMessage()]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsConversationsLoading(false);
    }
  };

  const getWelcomeMessage = () => ({
    id: 'welcome-msg',
    role: 'assistant',
    content: `Hello ${user?.name || 'Student'}! I am Mentora, your AI academic study companion.\n\nAsk me anything about your uploaded study materials, textbooks, or lecture slides. Every answer is grounded directly in your documents with verified page citations and explanations.`,
    sources: [],
    suggestedFollowUps: [
      'What are the core topics covered in my documents?',
      'Can you explain the most challenging concept here simply?',
      'Give me an overview of the key terms and definitions.',
    ],
  });

  const selectConversation = async (convId) => {
    setActiveConversationId(convId);
    setMobileSidebarOpen(false);
    setChatError(null);
    setIsMessagesLoading(true);
    try {
      const convData = await chatService.getConversation(convId);
      if (convData && convData.messages) {
        if (convData.messages.length === 0) {
          setMessages([getWelcomeMessage()]);
        } else {
          setMessages(convData.messages);
        }
      }
    } catch (err) {
      setChatError('Failed to load conversation history.');
      console.error(err);
    } finally {
      setIsMessagesLoading(false);
    }
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setMessages([getWelcomeMessage()]);
    setChatError(null);
    setMobileSidebarOpen(false);
  };

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this conversation?')) return;

    try {
      await chatService.deleteConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) {
        const remaining = conversations.filter(c => c.id !== convId);
        if (remaining.length > 0) {
          selectConversation(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      alert('Could not delete conversation.');
    }
  };

  const toggleSourceSection = (msgId) => {
    setExpandedSources(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const toggleSnippet = (sourceId) => {
    setExpandedSnippet(prev => ({ ...prev, [sourceId]: !prev[sourceId] }));
  };

  const handleSend = async (overrideContent = null) => {
    const textToSend = typeof overrideContent === 'string' ? overrideContent : inputMessage;
    if (!textToSend || !textToSend.trim() || isSending) return;

    const trimmed = textToSend.trim();
    setInputMessage('');
    setChatError(null);

    // Optimistic user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => (prev.length === 1 && prev[0].id === 'welcome-msg') ? [tempUserMsg] : [...prev, tempUserMsg]);
    setIsSending(true);

    try {
      const response = await chatService.sendMessage({
        conversationId: activeConversationId,
        content: trimmed,
        documentId: selectedDocId || undefined,
        mode: explanationMode,
      });

      // Update active conversation
      if (!activeConversationId && response.conversation?.id) {
        setActiveConversationId(response.conversation.id);
        // Add new conversation to list
        setConversations(prev => [{
          id: response.conversation.id,
          title: response.conversation.title,
          messageCount: 2,
          updatedAt: new Date().toISOString(),
        }, ...prev]);
      }

      // Replace optimistic message and append real AI message
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempUserMsg.id);
        return [...filtered, response.userMessage, response.assistantMessage];
      });

      // Auto-expand sources for the newly received response if any
      if (response.assistantMessage?.sources?.length > 0) {
        setExpandedSources(p => ({ ...p, [response.assistantMessage.id]: true }));
      }
    } catch (err) {
      console.error('Chat error:', err);
      setChatError(err.response?.data?.message || err.message || 'Failed to generate response. Please verify AI models.');
      // Append an informative error message from Mentora
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: '⚠️ Mentora was unable to generate an answer. Please verify that your local Ollama instance (qwen3.5:4b) is active and study documents are processed.',
          isError: true,
          sources: [],
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Route to Visual Learning Studio with context & modal picker
  const handleVisualizeAnswer = (msg) => {
    // Derive a clean, concise default topic from preceding question or first line
    let derivedTopic = '';
    const msgIndex = messages.findIndex((m) => m.id === msg.id);
    if (msgIndex > 0 && messages[msgIndex - 1]?.role === 'user') {
      derivedTopic = messages[msgIndex - 1].content.trim();
    } else {
      const lines = msg.content.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length > 0) {
        const firstLine = lines[0].replace(/^[#*\-•\s]+/, '').trim();
        derivedTopic = firstLine.length > 80 ? firstLine.substring(0, 80) + '...' : firstLine;
      }
    }
    setVisualizeModalTopic(derivedTopic || 'Academic Study Concept');
    setVisualizeModalType('concept_map');
    setVisualizeModalMsg(msg);
  };

  const handleConfirmVisualize = () => {
    if (!visualizeModalMsg) return;
    const msg = visualizeModalMsg;
    const primarySource =
      msg.sources?.[0]?.document?.filename ||
      documents.find((d) => d.id === selectedDocId)?.filename ||
      'Course Material';
    const convTitle =
      conversations.find((c) => c.id === activeConversationId)?.title || 'Study Chat';

    navigate('/visual-studio', {
      state: {
        visualizationType: visualizeModalType,
        topic: visualizeModalTopic.trim() || 'Academic Study Concept',
        chatResponseContext: msg.content,
        documentId: msg.sources?.[0]?.documentId || selectedDocId || null,
        documentName: primarySource,
        conversationId: activeConversationId,
        conversationTitle: convTitle,
        sources: msg.sources || [],
        autoGenerate: true,
      },
    });
    setVisualizeModalMsg(null);
  };

  // Filtered conversations
  const filteredConversations = conversations.filter(c =>
    (c.title || 'Conversation').toLowerCase().includes(conversationSearch.toLowerCase())
  );

  const selectedDocumentName = documents.find(d => d.id === selectedDocId)?.filename || 'All Study Materials';

  return (
    <div className="flex h-[calc(100vh-8.5rem)] gap-4 relative">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Conversations Sidebar */}
      <div
        className={`fixed md:relative z-40 inset-y-0 left-0 w-72 md:w-64 flex flex-col rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-3 shadow-card transition-transform duration-200 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <Button
            onClick={handleNewChat}
            className="flex-1 justify-start gap-2 shadow-sm"
            size="sm"
          >
            <Plus className="h-4 w-4" />
            <span className="font-semibold text-xs">New Study Chat</span>
          </Button>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden ml-2 p-1.5 rounded-lg text-text-secondary hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conversation Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-secondary dark:text-text-darkSecondary" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={conversationSearch}
            onChange={(e) => setConversationSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border-light dark:border-border-dark bg-background-light/50 dark:bg-surface-elevated/50 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary px-2 py-1 flex items-center justify-between">
          <span>Recent Conversations</span>
          <span className="text-[10px] lowercase font-normal">{conversations.length} total</span>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {isConversationsLoading ? (
            <div className="flex items-center justify-center p-6 text-xs text-text-secondary animate-pulse">
              Loading chats...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center p-6 text-xs text-text-secondary dark:text-text-darkSecondary">
              <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-30" />
              <span>No study conversations found. Start a new one!</span>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isActive = conv.id === activeConversationId;
              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`group relative flex items-center justify-between w-full text-left p-2.5 rounded-xl cursor-pointer transition-colors text-xs ${
                    isActive
                      ? 'bg-primary/10 text-primary dark:text-primary-dark font-medium border border-primary/20'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-text-primary dark:text-text-darkPrimary'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-6">
                    <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-primary' : 'text-text-secondary opacity-60'}`} />
                    <span className="truncate">{conv.title || 'Untitled Chat'}</span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    title="Delete Conversation"
                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity p-1 rounded"
                  >
                    <Trash2 className="h-3 w-3 text-text-secondary hover:text-red-500" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex flex-1 flex-col rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-card overflow-hidden">
        {/* Chat Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-border-light dark:border-border-dark px-4 py-2.5 gap-2 bg-white/70 dark:bg-surface-dark/70 backdrop-blur-sm z-20">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-1.5 rounded-lg border border-border-light dark:border-border-dark text-text-secondary hover:bg-black/5"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
            <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary dark:text-primary-dark flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-primary dark:text-text-darkPrimary leading-none">
                AI Study Chat
              </h2>
              <span className="text-[11px] text-text-secondary dark:text-text-darkSecondary flex items-center gap-1 mt-0.5">
                <Bookmark className="h-3 w-3 text-primary" />
                Grounded in: <strong className="text-text-primary dark:text-text-darkPrimary">{selectedDocumentName}</strong>
              </span>
            </div>
          </div>

          {/* Controls: Document Grounding Selector & Mode Toggle */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Document Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDocDropdownOpen(!isDocDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-surface-elevated text-xs font-medium text-text-primary dark:text-text-darkPrimary hover:border-primary/50 transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[130px] truncate">{selectedDocumentName}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>

              {isDocDropdownOpen && (
                <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark p-1.5 shadow-xl z-50">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary px-2 py-1">
                    Select Study Material
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDocId('');
                      setIsDocDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                      selectedDocId === ''
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'hover:bg-black/5 dark:hover:bg-white/5 text-text-primary dark:text-text-darkPrimary'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-primary" />
                      All Study Materials
                    </span>
                    {selectedDocId === '' && <Check className="h-3 w-3 text-primary" />}
                  </button>

                  <div className="my-1 border-t border-border-light dark:border-border-dark" />

                  {documents.length === 0 ? (
                    <div className="px-2 py-3 text-[11px] text-text-secondary text-center">
                      No processed documents found.<br />Upload a PDF or DOCX in Study Materials.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-0.5 custom-scrollbar">
                      {documents.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => {
                            setSelectedDocId(doc.id);
                            setIsDocDropdownOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between truncate ${
                            selectedDocId === doc.id
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'hover:bg-black/5 dark:hover:bg-white/5 text-text-primary dark:text-text-darkPrimary'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <FileText className="h-3.5 w-3.5 text-text-secondary shrink-0" />
                            <span className="truncate">{doc.filename}</span>
                          </span>
                          {selectedDocId === doc.id && <Check className="h-3 w-3 text-primary shrink-0 ml-1" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Explanation Mode Toggle */}
            <button
              onClick={() => setExplanationMode(m => m === 'standard' ? 'simple_explanation' : 'standard')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                explanationMode === 'simple_explanation'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'bg-background-light dark:bg-surface-elevated border-border-light dark:border-border-dark text-text-secondary hover:text-text-primary'
              }`}
              title="Toggle Simple Explanation Mode: Explains concepts with step-by-step analogies and plain language"
            >
              <Lightbulb className={`h-3.5 w-3.5 ${explanationMode === 'simple_explanation' ? 'text-amber-500 fill-amber-500/30' : ''}`} />
              <span className="hidden sm:inline">
                {explanationMode === 'simple_explanation' ? 'Simple Mode' : 'Academic'}
              </span>
            </button>

            <Badge variant="success" className="text-[10px] hidden sm:flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              RAG Active
            </Badge>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {isMessagesLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-text-secondary text-sm space-y-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Loading conversation history...</span>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const hasSources = msg.sources && msg.sources.length > 0;
              const isSourcesExpanded = expandedSources[msg.id] ?? false;

              return (
                <div
                  key={msg.id || index}
                  className={`flex gap-3 max-w-4xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div
                    className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold shadow-sm ${
                      isUser
                        ? 'bg-primary text-white'
                        : msg.isError
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-primary/10 text-primary dark:text-primary-dark border border-primary/20'
                    }`}
                  >
                    {isUser ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>

                  {/* Message Content Container */}
                  <div className={`space-y-2 max-w-[85%] sm:max-w-[78%] ${isUser ? 'items-end' : ''}`}>
                    {/* Bubble */}
                    <div
                      className={`rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? 'bg-primary text-white font-normal'
                          : msg.isError
                          ? 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30'
                          : 'bg-background-light dark:bg-surface-elevated text-text-primary dark:text-text-darkPrimary border border-border-light dark:border-border-dark'
                      }`}
                    >
                      {isUser ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <MarkdownContent content={msg.content} />
                      )}
                    </div>

                    {/* Verified Academic Sources Section (collapsible) */}
                    {hasSources && (
                      <div className="rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark overflow-hidden shadow-sm">
                        <button
                          type="button"
                          onClick={() => toggleSourceSection(msg.id)}
                          className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-text-primary dark:text-text-darkPrimary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Bookmark className="h-3.5 w-3.5 text-primary" />
                            <span>Verified Academic Sources ({msg.sources.length})</span>
                          </span>
                          {isSourcesExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5 opacity-60" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                          )}
                        </button>

                        {isSourcesExpanded && (
                          <div className="p-3 pt-1 border-t border-border-light dark:border-border-dark space-y-2 text-xs">
                            {msg.sources.map((src, i) => {
                              const sourceId = src.id || `${msg.id}-src-${i}`;
                              const docTitle = src.document?.filename || src.document_name || 'Study Document';
                              const pageNum = src.pageNumber || src.page_number || 1;
                              const score = src.relevanceScore || src.relevance_score || 0;
                              const scorePercent = Math.round(score * 100);
                              const snippetText = src.snippet || '';
                              const isSnippetOpen = expandedSnippet[sourceId] ?? false;

                              return (
                                <div
                                  key={sourceId}
                                  className="p-2.5 rounded-lg border border-border-light/60 dark:border-border-dark/60 bg-background-light/40 dark:bg-surface-elevated/40 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="font-semibold text-text-primary dark:text-text-darkPrimary truncate flex items-center gap-1.5">
                                      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                                      <span className="truncate">{docTitle}</span>
                                      <span className="text-text-secondary dark:text-text-darkSecondary font-normal">
                                        (Page {pageNum})
                                      </span>
                                    </span>
                                    <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                                      Match {scorePercent}%
                                    </Badge>
                                  </div>

                                  {snippetText && (
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => toggleSnippet(sourceId)}
                                        className="text-[10px] text-primary hover:underline flex items-center gap-1 font-medium"
                                      >
                                        {isSnippetOpen ? 'Hide text excerpt' : 'View cited excerpt'}
                                      </button>
                                      {isSnippetOpen && (
                                        <p className="mt-1.5 p-2 rounded bg-black/5 dark:bg-white/5 text-[11px] text-text-secondary dark:text-text-darkSecondary italic border-l-2 border-primary leading-relaxed">
                                          "{snippetText}"
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Suggested Follow-up Questions & Visualize Action */}
                    {!isUser && !msg.isError && (
                      <div className="space-y-2 pt-1">
                        {/* Action: Visualize this Answer */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleVisualizeAnswer(msg)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary dark:text-primary-light hover:text-primary-dark transition-colors px-2.5 py-1 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/20"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            <span>Visualize This Answer</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Suggested Follow-ups */}
                        {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {msg.suggestedFollowUps.map((question, qIdx) => (
                              <button
                                key={qIdx}
                                type="button"
                                onClick={() => handleSend(question)}
                                className="text-[11px] px-2.5 py-1 rounded-full border border-border-light dark:border-border-dark bg-background-light dark:bg-surface-elevated text-text-secondary dark:text-text-darkSecondary hover:border-primary hover:text-primary transition-all text-left"
                              >
                                💡 {question}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Thinking / Generating Indicator */}
          {isSending && (
            <div className="flex gap-3 max-w-3xl">
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary dark:text-primary-dark flex items-center justify-center shrink-0 border border-primary/20">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl p-4 text-xs bg-background-light dark:bg-surface-elevated border border-border-light dark:border-border-dark text-text-secondary dark:text-text-darkSecondary flex items-center gap-2.5">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                <span>Mentora is reading your documents and formulating a grounded answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form & Controls */}
        <div className="p-3 sm:p-4 border-t border-border-light dark:border-border-dark bg-background-light/40 dark:bg-surface-elevated/40">
          {/* Active document indicator if single document is chosen */}
          {selectedDocId && (
            <div className="flex items-center justify-between mb-2 px-2 text-[11px] text-text-secondary">
              <span className="flex items-center gap-1 truncate">
                <Bookmark className="h-3 w-3 text-primary" />
                Filtering answers strictly to: <strong className="text-text-primary truncate">{selectedDocumentName}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedDocId('')}
                className="text-primary hover:underline font-semibold"
              >
                Clear filter
              </button>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 items-end">
            <textarea
              rows={2}
              placeholder="Ask anything about your study materials (e.g. 'Explain Demand Paging' or 'Compare Process and Thread')..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSending}
              className="flex-1 resize-none rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark px-4 py-2.5 text-sm text-text-primary dark:text-text-darkPrimary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary custom-scrollbar leading-relaxed"
            />
            <Button
              type="submit"
              disabled={!inputMessage.trim() || isSending}
              className="h-11 px-4 rounded-xl shrink-0"
            >
              {isSending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
          <div className="flex items-center justify-between mt-1.5 px-2 text-[10px] text-text-secondary dark:text-text-darkSecondary">
            <span>Press <kbd className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono">Shift+Enter</kbd> for newline</span>
            <span>Grounded with BGE-M3 + ChromaDB + Qwen 3.5 4B</span>
          </div>
        </div>
      </div>

      {/* Visualize This Answer Modal */}
      {visualizeModalMsg && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-border-light dark:border-border-dark flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary dark:text-primary-dark flex items-center justify-center">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary dark:text-text-darkPrimary">
                    Visualize This Answer
                  </h3>
                  <p className="text-xs text-text-secondary dark:text-text-darkSecondary">
                    Select a visual study format to transform this AI explanation into an interactive diagram.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVisualizeModalMsg(null)}
                className="p-1.5 rounded-lg text-text-secondary hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
              {/* Topic Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1.5">
                  Diagram Title / Target Concept
                </label>
                <input
                  type="text"
                  value={visualizeModalTopic}
                  onChange={(e) => setVisualizeModalTopic(e.target.value)}
                  placeholder="e.g. Instruction Pipelining Stages and Hazards"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-surface-elevated text-sm text-text-primary dark:text-text-darkPrimary focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Visualization Type Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Select Visualization Type
                  </label>
                  <span className="text-[11px] text-text-secondary">6 Supported Formats</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {VISUALIZATION_TYPES.map((type) => {
                    const Icon = type.icon;
                    const isSelected = visualizeModalType === type.id;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setVisualizeModalType(type.id)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20 dark:bg-primary/10 shadow-xs'
                            : 'border-border-light dark:border-border-dark hover:border-primary/40 bg-white dark:bg-surface-dark'
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isSelected
                              ? 'bg-primary text-white'
                              : 'bg-primary/10 text-primary dark:text-primary-dark'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-text-primary dark:text-text-darkPrimary">
                              {type.name}
                            </h4>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-text-secondary font-mono">
                              {type.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-text-secondary line-clamp-1 mt-0.5">
                            {type.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source & Grounding Summary */}
              <div className="p-3.5 rounded-xl border border-border-light dark:border-border-dark bg-background-light/50 dark:bg-surface-elevated/40 space-y-1.5 text-xs text-text-secondary">
                <div className="flex items-center justify-between text-[11px] font-semibold text-text-primary dark:text-text-darkPrimary">
                  <span className="flex items-center gap-1.5">
                    <Bookmark className="h-3.5 w-3.5 text-primary" />
                    Preserved Context & References
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    No Re-upload Needed
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                  <span>
                    Conversation:{' '}
                    <strong className="text-text-primary">
                      {conversations.find((c) => c.id === activeConversationId)?.title ||
                        'Current Chat'}
                    </strong>
                  </span>
                  <span>
                    Grounded in:{' '}
                    <strong className="text-text-primary">
                      {visualizeModalMsg.sources?.[0]?.document?.filename || selectedDocumentName}
                    </strong>
                  </span>
                  {visualizeModalMsg.sources?.length > 0 && (
                    <span>
                      Citations:{' '}
                      <strong className="text-text-primary">
                        {visualizeModalMsg.sources.length} Verified Page Chunks
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border-light dark:border-border-dark flex items-center justify-end gap-2 bg-background-light/30 dark:bg-surface-elevated/20">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisualizeModalMsg(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmVisualize}
                disabled={!visualizeModalTopic.trim()}
                className="gap-1.5"
              >
                <Sparkles className="h-4 w-4" />
                <span>Open in Visual Studio & Generate</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
