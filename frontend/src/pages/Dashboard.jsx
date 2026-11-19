import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import dashboardService from '../services/dashboard.service';
import documentService from '../services/document.service';
import chatService from '../services/chat.service';
import {
  MessageSquare,
  Sparkles,
  BookOpen,
  ArrowRight,
  Upload,
  Cpu,
  CheckCircle2,
  FileText,
  RefreshCw,
  Loader2,
  Clock,
  Layers,
  FileCheck,
  AlertCircle,
  ExternalLink
} from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuth();

  const [stats, setStats] = useState({
    documentsCount: 0,
    conversationsCount: 0,
    visualizationsCount: 0,
    aiStatus: 'online',
    databaseStatus: 'healthy',
  });
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [recentConversations, setRecentConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Load aggregated dashboard data
  const loadDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);

    try {
      // 1. Try unified dashboard API
      const data = await dashboardService.getDashboardData();
      if (data) {
        if (data.stats) {
          setStats(data.stats);
        }
        if (Array.isArray(data.recentDocuments)) {
          setRecentDocuments(data.recentDocuments);
        }
        if (Array.isArray(data.recentConversations)) {
          setRecentConversations(data.recentConversations);
        }
      }
    } catch (err) {
      console.warn('Unified dashboard API unavailable, falling back to individual services:', err.message);
      // Fallback: fetch directly from available endpoints
      try {
        const [docsRes, convsRes] = await Promise.allSettled([
          documentService.getDocuments(),
          chatService.getConversations(),
        ]);

        const docs = docsRes.status === 'fulfilled' && docsRes.value?.data ? docsRes.value.data : [];
        const convs = convsRes.status === 'fulfilled' && convsRes.value ? convsRes.value : [];

        setRecentDocuments(docs.slice(0, 5));
        setRecentConversations(convs.slice(0, 5));
        setStats((prev) => ({
          ...prev,
          documentsCount: docs.length,
          conversationsCount: convs.length,
        }));
      } catch (fallbackErr) {
        console.error('Failed to load dashboard fallback data:', fallbackErr);
        setError('Could not update dashboard data. Please try refreshing.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Polling if any recent documents are actively processing
  useEffect(() => {
    const hasProcessingDocs = recentDocuments.some((doc) =>
      ['UPLOADED', 'PROCESSING', 'EXTRACTING', 'EMBEDDING', 'INDEXING', 'pending'].includes(
        doc.processingStatus
      )
    );

    if (!hasProcessingDocs) return;

    const timer = setInterval(() => {
      loadDashboardData();
    }, 4000);

    return () => clearInterval(timer);
  }, [recentDocuments, loadDashboardData]);

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const renderStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
          <CheckCircle2 className="h-3 w-3" />
          Ready
        </span>
      );
    }
    if (s === 'FAILED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
          <AlertCircle className="h-3 w-3" />
          Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
        <Loader2 className="h-3 w-3 animate-spin" />
        Processing
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary-hover to-secondary p-6 sm:p-8 text-white shadow-elevated">
        <div className="relative z-10 max-w-2xl space-y-2">
          <Badge className="bg-white/20 text-white border-none mb-2">
            Mentora v1.0 AI Study Assistant
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Welcome back, {user?.name || 'Student'}!
          </h1>
          <p className="text-sm sm:text-base text-white/90 leading-relaxed">
            Ready to explore your coursework? Mentora helps you understand complex academic concepts through conversational RAG and automatic diagrams.
          </p>
          <div className="pt-3 flex flex-wrap gap-3">
            <Link to="/chat">
              <Button className="bg-white text-primary hover:bg-white/90 font-semibold shadow-md">
                <MessageSquare className="mr-2 h-4 w-4 text-primary" />
                Start AI Study Chat
              </Button>
            </Link>
            <Link to="/studio">
              <Button variant="outline" className="text-white border-white/30 hover:bg-white/10">
                <Sparkles className="mr-2 h-4 w-4" />
                Open Visual Studio
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Quick Stats & Live System Status */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-tight text-text-primary dark:text-text-darkPrimary">
            Your Study Activity
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            className="text-xs text-text-secondary hover:text-text-primary gap-1.5"
            title="Refresh dashboard stats"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-primary' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Study Materials */}
          <Link to="/materials" className="group">
            <Card className="p-4 hover:border-primary/50 transition-all h-full">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20 transition-colors">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary dark:text-text-darkSecondary font-medium">Study Materials</p>
                  <p className="text-xl font-bold text-text-primary dark:text-text-darkPrimary">
                    {loading ? (
                      <span className="inline-block h-6 w-12 bg-border-light dark:bg-border-dark animate-pulse rounded" />
                    ) : (
                      `${stats.documentsCount} ${stats.documentsCount === 1 ? 'Doc' : 'Docs'}`
                    )}
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          {/* 2. Active Conversations */}
          <Link to="/chat" className="group">
            <Card className="p-4 hover:border-primary/50 transition-all h-full">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary dark:text-text-darkSecondary font-medium">Active Conversations</p>
                  <p className="text-xl font-bold text-text-primary dark:text-text-darkPrimary">
                    {loading ? (
                      <span className="inline-block h-6 w-12 bg-border-light dark:bg-border-dark animate-pulse rounded" />
                    ) : (
                      `${stats.conversationsCount} ${stats.conversationsCount === 1 ? 'Chat' : 'Chats'}`
                    )}
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          {/* 3. Visualizations */}
          <Link to="/studio" className="group">
            <Card className="p-4 hover:border-primary/50 transition-all h-full">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 group-hover:bg-purple-500/20 transition-colors">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-text-secondary dark:text-text-darkSecondary font-medium">Visualizations</p>
                  <p className="text-xl font-bold text-text-primary dark:text-text-darkPrimary">
                    {loading ? (
                      <span className="inline-block h-6 w-12 bg-border-light dark:bg-border-dark animate-pulse rounded" />
                    ) : (
                      `${stats.visualizationsCount} ${stats.visualizationsCount === 1 ? 'Graph' : 'Graphs'}`
                    )}
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          {/* 4. AI & Database Health */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-text-secondary dark:text-text-darkSecondary font-medium">AI & Database</p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      stats.aiStatus === 'online' && stats.databaseStatus === 'healthy'
                        ? 'bg-status-success animate-pulse'
                        : 'bg-status-warning'
                    }`}
                  />
                  <p className="text-sm font-bold text-text-primary dark:text-text-darkPrimary">
                    {stats.aiStatus === 'online' && stats.databaseStatus === 'healthy'
                      ? 'Engine Ready'
                      : 'Degraded Mode'}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Two Core Modules Grid */}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-text-primary dark:text-text-darkPrimary mb-4">
          Core Study Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Module 1: AI Study Chatbot */}
          <Card className="hover:border-primary/50 transition-all group">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary dark:text-primary-dark">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <Badge variant="default">Module 1</Badge>
              </div>
              <CardTitle className="pt-3 text-xl group-hover:text-primary transition-colors">
                AI Study Chatbot
              </CardTitle>
              <CardDescription>
                Ask natural questions about your course materials. Receive answers grounded in your uploaded documents with exact page citations and follow-up support.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-text-secondary dark:text-text-darkSecondary space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
                  RAG-powered responses via Qwen 2.5/3.5
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
                  Transparent page & document citations
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
                  Conversation context & history preservation
                </li>
              </ul>
              <Link to="/chat">
                <Button className="w-full justify-between">
                  <span>Open Chat Assistant</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Module 2: Graphical Study Content Generator */}
          <Card className="hover:border-primary/50 transition-all group">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <Badge variant="secondary">Module 2</Badge>
              </div>
              <CardTitle className="pt-3 text-xl group-hover:text-primary transition-colors">
                Graphical Study Generator
              </CardTitle>
              <CardDescription>
                Convert academic paragraphs and textbooks into interactive diagrams, concept maps, flowcharts, and infographics to visualize key concepts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-xs text-text-secondary dark:text-text-darkSecondary space-y-2 mb-6">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
                  6 distinct visualization types supported
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
                  Mermaid.js & React Flow rendering engines
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-status-success shrink-0" />
                  Export to SVG/PNG for review and revision
                </li>
              </ul>
              <Link to="/studio">
                <Button variant="secondary" className="w-full justify-between">
                  <span>Open Visual Learning Studio</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity Sections (Recent Study Materials & Recent Conversations) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Study Materials */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Recent Study Materials
              </CardTitle>
              <CardDescription>
                Documents recently uploaded and indexed in your knowledge base.
              </CardDescription>
            </div>
            <Link to="/materials">
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary hover:text-primary-hover">
                <span>View All</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center text-text-secondary text-xs">
                <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                <span>Loading study materials...</span>
              </div>
            ) : recentDocuments.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl border border-dashed border-border-light dark:border-border-dark">
                <FileText className="h-8 w-8 text-text-secondary/60 mx-auto mb-2" />
                <p className="text-sm font-semibold text-text-primary dark:text-text-darkPrimary mb-1">
                  No study materials uploaded
                </p>
                <p className="text-xs text-text-secondary dark:text-text-darkSecondary max-w-xs mx-auto mb-4">
                  Upload lecture notes, textbooks, or slides in PDF, DOCX, PPTX, or TXT format to ground your assistant.
                </p>
                <Link to="/materials">
                  <Button size="sm" className="gap-1.5 text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Materials</span>
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border-light dark:divide-border-dark">
                {recentDocuments.map((doc) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary dark:text-text-darkPrimary truncate group-hover:text-primary transition-colors">
                          {doc.filename}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-text-secondary dark:text-text-darkSecondary">
                          <span className="uppercase font-mono">{doc.fileType}</span>
                          <span>•</span>
                          <span>{doc.pageCount > 0 ? `${doc.pageCount} pages` : formatFileSize(doc.fileSize)}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(doc.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {renderStatusBadge(doc.processingStatus)}
                      <Link to={`/chat?documentId=${doc.id}`} title="Chat with this document">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-text-secondary hover:text-primary">
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Conversations */}
        <Card className="flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Recent Conversations
              </CardTitle>
              <CardDescription>
                Pick up right where you left off in your academic discussions.
              </CardDescription>
            </div>
            <Link to="/chat">
              <Button variant="ghost" size="sm" className="text-xs gap-1 text-primary hover:text-primary-hover">
                <span>View All</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="flex-1">
            {loading ? (
              <div className="py-8 flex flex-col items-center justify-center text-text-secondary text-xs">
                <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                <span>Loading conversations...</span>
              </div>
            ) : recentConversations.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl border border-dashed border-border-light dark:border-border-dark">
                <MessageSquare className="h-8 w-8 text-text-secondary/60 mx-auto mb-2" />
                <p className="text-sm font-semibold text-text-primary dark:text-text-darkPrimary mb-1">
                  No conversations yet
                </p>
                <p className="text-xs text-text-secondary dark:text-text-darkSecondary max-w-xs mx-auto mb-4">
                  Start asking questions about your course materials with grounded citations and analogies.
                </p>
                <Link to="/chat">
                  <Button size="sm" className="gap-1.5 text-xs">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Start New Chat</span>
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border-light dark:divide-border-dark">
                {recentConversations.map((conv) => (
                  <div key={conv.id} className="py-3 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <MessageSquare className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary dark:text-text-darkPrimary truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          {conv.title || 'Untitled Conversation'}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-text-secondary dark:text-text-darkSecondary">
                          <span>{conv._count?.messages || 0} messages</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(conv.updatedAt || conv.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Link to={`/chat?conversation=${conv.id}`}>
                      <Button variant="outline" size="sm" className="text-xs h-8 gap-1">
                        <span>Continue</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Getting Started Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Getting Started with Mentora</CardTitle>
          <CardDescription>
            Follow these 3 quick steps to study effectively with your personal AI assistant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-surface-elevated">
              <div className="flex items-center gap-2 font-semibold text-sm mb-1 text-text-primary dark:text-text-darkPrimary">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs">1</span>
                Upload Materials
              </div>
              <p className="text-xs text-text-secondary dark:text-text-darkSecondary">
                Upload your lecture notes, textbook chapters, or slides in PDF, DOCX, PPTX, or TXT format.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-surface-elevated">
              <div className="flex items-center gap-2 font-semibold text-sm mb-1 text-text-primary dark:text-text-darkPrimary">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs">2</span>
                Ask Questions
              </div>
              <p className="text-xs text-text-secondary dark:text-text-darkSecondary">
                Chat naturally with the AI. Inquire about difficult formulas, concepts, or ask for simple analogies.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-surface-elevated">
              <div className="flex items-center gap-2 font-semibold text-sm mb-1 text-text-primary dark:text-text-darkPrimary">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-xs">3</span>
                Visualize Concepts
              </div>
              <p className="text-xs text-text-secondary dark:text-text-darkSecondary">
                Generate infographics, concept maps, or flowcharts directly from answers or selected documents.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
