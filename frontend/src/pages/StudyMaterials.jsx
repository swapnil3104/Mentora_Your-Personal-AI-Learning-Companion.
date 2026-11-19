import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Alert } from '../components/ui/Alert';
import documentService from '../services/document.service';
import {
  Upload,
  FileText,
  Search,
  Filter,
  AlertCircle,
  FileCheck,
  FolderOpen,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  File
} from 'lucide-react';

export const StudyMaterials = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [actionError, setActionError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const fileInputRef = useRef(null);

  const supportedFormats = [
    { ext: 'PDF', desc: 'Lecture slides & Textbooks' },
    { ext: 'DOCX', desc: 'Word documents & Notes' },
    { ext: 'PPTX', desc: 'Presentation slides' },
    { ext: 'TXT', desc: 'Plain text study files' },
  ];

  // Fetch documents from backend API
  const fetchDocuments = async () => {
    try {
      const response = await documentService.getDocuments(searchQuery);
      if (response && response.data) {
        setDocuments(response.data);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [searchQuery]);

  // Polling for documents currently being processed
  useEffect(() => {
    const hasPendingDocs = documents.some((doc) =>
      ['UPLOADED', 'PROCESSING', 'EXTRACTING', 'EMBEDDING', 'INDEXING', 'pending'].includes(
        doc.processingStatus
      )
    );

    if (!hasPendingDocs) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

  const handleFileSelect = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Client-side extension validation
    const validExtensions = ['.pdf', '.docx', '.pptx', '.txt'];
    const fileName = file.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!isValidExt) {
      setActionError(`Invalid file format. Supported formats are: ${validExtensions.join(', ')}`);
      return;
    }

    // Client-side size validation (25MB limit)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      setActionError('File size exceeds the 25MB limit.');
      return;
    }

    setActionError(null);
    setActionSuccess(null);
    setUploading(true);
    setUploadProgress(0);

    try {
      await documentService.uploadDocument(file, (progress) => {
        setUploadProgress(progress);
      });
      setActionSuccess(`"${file.name}" uploaded successfully. Processing started.`);
      await fetchDocuments();
    } catch (err) {
      const errorMsg =
        err.response?.data?.message || err.message || 'Failed to upload document.';
      setActionError(errorMsg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDelete = async (id, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"? All associated vectors will also be removed.`)) {
      return;
    }

    setDeletingId(id);
    setActionError(null);
    try {
      await documentService.deleteDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setActionSuccess(`"${filename}" removed successfully.`);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to delete document.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetry = async (id, filename) => {
    setActionError(null);
    try {
      await documentService.retryProcessing(id);
      setActionSuccess(`Reprocessing started for "${filename}".`);
      await fetchDocuments();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to retry processing.');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ready for RAG
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50">
            <AlertCircle className="h-3.5 w-3.5" />
            Failed
          </span>
        );
      case 'EXTRACTING':
      case 'EMBEDDING':
      case 'INDEXING':
      case 'PROCESSING':
      case 'UPLOADED':
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {s || 'PROCESSING'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary dark:text-text-darkPrimary">
            Study Materials
          </h1>
          <p className="text-sm text-text-secondary dark:text-text-darkSecondary">
            Manage your uploaded academic documents, chunking pipelines, and vector knowledge base.
          </p>
        </div>
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 gap-2"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span>{uploading ? 'Uploading...' : 'Upload Document'}</span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.txt"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Notifications */}
      {actionError && (
        <Alert variant="danger" onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}
      {actionSuccess && (
        <Alert variant="success" onClose={() => setActionSuccess(null)}>
          {actionSuccess}
        </Alert>
      )}

      {/* Upload Zone */}
      <Card
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`border-dashed border-2 transition-all cursor-pointer ${
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.005]'
            : 'border-border-light dark:border-border-dark hover:border-primary/60 bg-background-light/40 dark:bg-surface-elevated/40'
        }`}
      >
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary dark:text-primary-dark mb-4">
            {uploading ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Upload className="h-7 w-7" />
            )}
          </div>
          <h3 className="text-base font-semibold text-text-primary dark:text-text-darkPrimary mb-1">
            {uploading
              ? 'Uploading and Ingesting Document...'
              : 'Drag and drop your academic files here, or click to browse'}
          </h3>
          <p className="text-xs text-text-secondary dark:text-text-darkSecondary max-w-md mb-4">
            Upload PDF, DOCX, PPTX, or TXT documents up to 25MB. Files are extracted, chunked, embedded with BGE-M3, and stored in ChromaDB.
          </p>

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="w-full max-w-md mb-4">
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>Uploading to server...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full bg-border-light dark:bg-border-dark rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {supportedFormats.map((f) => (
              <Badge key={f.ext} variant="outline" className="text-[11px] font-mono">
                .{f.ext}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Document Library Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Document Library</CardTitle>
              <CardDescription>
                All documents indexed and available for the AI Chatbot and Visual Learning Studio.
              </CardDescription>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-surface-dark pl-9 pr-3 text-xs text-text-primary dark:text-text-darkPrimary placeholder:text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-xs text-text-secondary">Loading study materials...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-text-secondary mb-3">
                <FolderOpen className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-semibold text-text-primary dark:text-text-darkPrimary mb-1">
                {searchQuery ? 'No matching documents found' : 'No documents uploaded yet'}
              </h4>
              <p className="text-xs text-text-secondary dark:text-text-darkSecondary max-w-sm mb-4">
                {searchQuery
                  ? 'Try searching with a different keyword.'
                  : 'Upload your syllabus, lecture slides, or textbooks to begin using the AI assistant.'}
              </p>
              {!searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" />
                  Upload First Document
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-light dark:border-border-dark text-text-secondary">
                    <th className="pb-3 font-medium">Document Name</th>
                    <th className="pb-3 font-medium">Format</th>
                    <th className="pb-3 font-medium">Size</th>
                    <th className="pb-3 font-medium">Pages / Slides</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Uploaded</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      className="hover:bg-background-light/50 dark:hover:bg-surface-elevated/40 transition-colors"
                    >
                      <td className="py-3 font-medium text-text-primary dark:text-text-darkPrimary">
                        <div className="flex items-center gap-2 max-w-xs sm:max-w-md truncate">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate" title={doc.filename}>
                            {doc.filename}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 uppercase font-mono text-[11px] text-text-secondary">
                        <Badge variant="outline">{doc.fileType}</Badge>
                      </td>
                      <td className="py-3 text-text-secondary">
                        {formatFileSize(doc.fileSize)}
                      </td>
                      <td className="py-3 text-text-secondary">
                        {doc.pageCount > 0 ? doc.pageCount : '—'}
                      </td>
                      <td className="py-3">
                        {getStatusBadge(doc.processingStatus)}
                      </td>
                      <td className="py-3 text-text-secondary">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {doc.processingStatus === 'FAILED' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Retry processing"
                              onClick={() => handleRetry(doc.id, doc.filename)}
                              className="h-8 w-8 p-0 text-text-secondary hover:text-primary"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Delete document"
                            disabled={deletingId === doc.id}
                            onClick={() => handleDelete(doc.id, doc.filename)}
                            className="h-8 w-8 p-0 text-text-secondary hover:text-rose-600 dark:hover:text-rose-400"
                          >
                            {deletingId === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudyMaterials;
