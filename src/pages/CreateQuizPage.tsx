import { useState, useEffect } from 'react';
import { Upload, FileText, Sparkles, Download, Copy, Save, Share2, Clock, FolderPlus, X, Bookmark } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QuestionEditor } from '@/components/QuestionEditor';
import { AIChatInterface } from '@/components/AIChatInterface';
import { generateQuestions } from '@/services/gemini';
import { extractTextFromPDF, isPDFFile } from '@/services/pdfService';
import { quizAPI, studentsAPI, bookmarksAPI } from '@/services/api';
import { Question, Quiz, Student } from '@/types';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { StudentTable } from '@/components/StudentTable';
import { Badge } from '@/components/ui/badge';

interface UploadedFile {
  id: string;
  name: string;
  content: string;
  type: string;
}

export default function CreateQuizPage() {
  const location = useLocation();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [moduleText, setModuleText] = useState('');
  const [numQuestions, setNumQuestions] = useState('5');
  const [questionType, setQuestionType] = useState<'mcq' | 'short-answer' | 'mixed'>('mcq');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium');
  const [quizDuration, setQuizDuration] = useState('30');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [generating, setGenerating] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');

  const [students, setStudents] = useState<Student[]>([]);
  const [sharedLinks, setSharedLinks] = useState<{ email: string; link: string }[]>([]);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);

  useEffect(() => {
    // Fetch students for sharing
    const fetchStudents = async () => {
      try {
        const data = await studentsAPI.getAll();
        setStudents(data || []);
      } catch (error) {
        console.error('Error fetching students:', error);
      }
    };
    fetchStudents();

    // Handle edit question from bookmarks
    if (location.state?.editQuestion) {
      const editQ = location.state.editQuestion;
      setQuestions([{ ...editQ, isSelected: true }]);
    }
  }, [location]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const newFiles: UploadedFile[] = [];

    for (const file of fileArray) {
      try {
        let content = '';

        if (isPDFFile(file)) {
          toast.info(`Extracting text from ${file.name}...`);
          content = await extractTextFromPDF(file);
        } else {
          content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
          });
        }

        newFiles.push({
          id: `${Date.now()}-${file.name}`,
          name: file.name,
          content,
          type: file.type,
        });

        toast.success(`${file.name} loaded successfully`);
      } catch (error) {
        toast.error(`Failed to load ${file.name}`);
        console.error(error);
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    toast.success('File removed');
  };

  const handleGenerateQuestions = async (aiPrompt?: string) => {
    const combinedText = uploadedFiles.map((f) => f.content).join('\n\n') + '\n\n' + moduleText;

    if (!combinedText.trim()) {
      toast.error('Please upload files or paste notes');
      return;
    }

    const num = parseInt(numQuestions, 10);
    if (isNaN(num) || num < 1 || num > 50) {
      toast.error('Please enter a valid number of questions (1-50)');
      return;
    }

    setGenerating(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

      if (!apiKey) {
        toast.error('Gemini API key not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
        setGenerating(false);
        return;
      }

      const generatedQuestions = await generateQuestions({
        text: combinedText,
        numQuestions: num,
        type: questionType,
        difficulty,
        customPrompt: aiPrompt || customPrompt,
      });

      setQuestions(generatedQuestions || []);
      toast.success(`Successfully generated ${generatedQuestions?.length || 0} AI-powered questions!`);
    } catch (error) {
      console.error('Error generating questions:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate questions.');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateQuestion = (updatedQuestion: Question) => {
    setQuestions(questions.map(q => q.id === updatedQuestion.id ? updatedQuestion : q));
    toast.success('Question updated');
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    toast.success('Question deleted');
  };

  const handleToggleBookmark = async (id: string) => {
    const question = questions.find(q => q.id === id);
    if (!question) return;

    const newBookmarked = !question.isBookmarked;

    try {
      if (newBookmarked) {
        await bookmarksAPI.create({ question });
        toast.success('Question bookmarked');
      } else {
        toast.info('Bookmark removed from this session');
      }

      setQuestions(questions.map(q =>
        q.id === id ? { ...q, isBookmarked: newBookmarked } : q
      ));
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to update bookmark');
    }
  };

  const handleToggleSelect = (id: string) => {
    setQuestions(questions.map(q =>
      q.id === id ? { ...q, isSelected: !q.isSelected } : q
    ));
  };

  const handleExportJSON = () => {
    const selectedQuestions = questions.filter(q => q.isSelected);
    const dataStr = JSON.stringify(selectedQuestions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `questions_${Date.now()}.json`;
    link.click();
    toast.success('Questions exported to JSON');
  };

  const handleCopyToClipboard = () => {
    const selectedQuestions = questions.filter(q => q.isSelected);
    navigator.clipboard.writeText(JSON.stringify(selectedQuestions, null, 2));
    toast.success('Questions copied to clipboard');
  };

  // Save quiz to backend and return quizId (or throw)
  const saveQuizToServer = async (title: string, selectedQuestions: Question[]) => {
    const quizPayload: Partial<Quiz> = {
      title,
      questions: selectedQuestions,
      createdAt: new Date().toISOString(),
      numQuestions: selectedQuestions.length,
      questionType,
      duration: parseInt(quizDuration, 10),
      difficulty
    };

    const saveRes = await quizAPI.save(quizPayload as Quiz);
    const quizId = saveRes.quizId || (saveRes.quiz && (saveRes.quiz._id || saveRes.quiz.id));
    if (!quizId) {
      throw new Error('Server did not return quizId');
    }
    return quizId;
  };

  const handleSaveQuiz = async () => {
    const selectedQuestions = questions.filter(q => q.isSelected);

    if (selectedQuestions.length === 0) {
      toast.error('Please select at least one question');
      return;
    }

    if (!quizTitle.trim()) {
      toast.error('Please enter a quiz title');
      return;
    }

    setSaving(true);
    try {
      const quizId = await saveQuizToServer(quizTitle, selectedQuestions);
      toast.success('Quiz saved successfully!');
      setQuizTitle('');
      return quizId;
    } catch (error: any) {
      console.error('Error saving quiz:', error);
      toast.error(error?.message || 'Failed to save quiz');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const handleBookmarkQuiz = async () => {
    const selectedQuestions = questions.filter(q => q.isSelected);

    if (selectedQuestions.length === 0) {
      toast.error('Please select at least one question');
      return;
    }

    if (!quizTitle.trim()) {
      toast.error('Please enter a quiz title');
      return;
    }

    try {
      await bookmarksAPI.create({
        type: 'quiz',
        quiz: {
          title: quizTitle,
          description: `${selectedQuestions.length} questions`,
          questions: selectedQuestions,
          numQuestions: selectedQuestions.length,
          questionType: questionType,
          duration: parseInt(quizDuration, 10),
          difficulty,
        }
      });

      toast.success('Quiz bookmarked successfully!');
    } catch (error) {
      console.error('Error bookmarking quiz:', error);
      toast.error('Failed to bookmark quiz');
    }
  };

  // Robust share flow: save then share; defensive student -> email mapping; show server errors
  const handleShareQuiz = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select at least one student');
      return;
    }

    const selectedQuestions = questions.filter(q => q.isSelected);
    if (selectedQuestions.length === 0) {
      toast.error('Please select at least one question');
      return;
    }

    if (!quizTitle.trim()) {
      toast.error('Please enter a quiz title before sharing');
      return;
    }

    setSaving(true);
    try {
      // 1) Save quiz and get quizId
      const quizId = await saveQuizToServer(quizTitle, selectedQuestions);

      // 2) Defensive mapping: ensure we have an array of emails
      let studentEmails = (selectedStudents || []).map((s) => {
        // If s is an email string
        if (typeof s === 'string' && s.includes('@')) return s.trim();

        // If s is a JSON stringified object
        try {
          const parsed = JSON.parse(String(s));
          if (parsed && typeof parsed === 'object' && parsed.email) return String(parsed.email).trim();
        } catch (_) { /* ignore */ }

        // If s is an id or plain string (maybe id) try to find in students list
        const found = students.find(st => (st as any)._id === s || (st as any).id === s || st.email === s);
        return found ? found.email : '';
      }).filter(Boolean);

      // remove duplicates and simple invalids
      studentEmails = Array.from(new Set(studentEmails)).filter(email => typeof email === 'string' && email.includes('@'));

      if (studentEmails.length === 0) {
        toast.error('No valid student emails to share to');
        setSaving(false);
        return;
      }

      // explicit typing (include links to satisfy QuizShare shape)
      const sharePayload: { quizId: string; studentEmails: string[]; links: Array<{ email: string; link: string; token: string }> } = {
        quizId,
        studentEmails,
        links: []
      };

      console.debug('sharePayload ->', sharePayload);

      const result = await quizAPI.share(sharePayload);

      console.debug('share result ->', result);

      const links = Array.isArray(result.links) ? result.links : [];
      setSharedLinks(links.map((l: any) => ({ email: l.email, link: l.link })));

      if (links.length === 0) {
        toast('Share completed but no links were returned. Check server response in console/network.');
        console.warn('Share result had no links:', result);
      } else {
        toast.success(`Quiz links generated for ${links.length} students`);
        setLinksDialogOpen(true);
      }

      setShareDialogOpen(false);
    } catch (err: any) {
      console.error('Error sharing quiz:', err);

      if (err?.response?.data) {
        const data = err.response.data;
        console.error('Server response:', data);
        const serverMsg =
          data?.message ||
          (Array.isArray(data?.failedValidation) && data.failedValidation.map((f: any) => `${f.email || f}: ${f.reason}`).join('; ')) ||
          (Array.isArray(data?.failedSend) && data.failedSend.map((f: any) => f.reason || JSON.stringify(f)).join('; ')) ||
          JSON.stringify(data);
        toast.error(`Share failed: ${serverMsg}`);
      } else {
        toast.error(err?.message || 'Failed to share quiz');
      }
    } finally {
      setSaving(false);
    }
  };

  const selectedCount = questions.filter(q => q.isSelected).length;

  const copyAllLinks = async () => {
    const text = sharedLinks.map(l => `${l.email}: ${l.link}`).join('\n');
    await navigator.clipboard.writeText(text);
    toast.success('Links copied to clipboard');
  };

  const downloadLinksAsCSV = () => {
    const csv = sharedLinks.map(l => `${l.email},${l.link}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quiz_links_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Links downloaded as CSV');
  };

  return (
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-1 md:space-y-2">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Create Quiz
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Upload module content and generate AI-powered questions with Gemini
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left Column - Upload & Settings */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* Module Upload */}
          <Card className="shadow-card hover-scale transition-all">
            <CardHeader className="space-y-1 md:space-y-2 pb-3 md:pb-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg lg:text-xl">
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                Module Content
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Upload multiple files (TXT/MD/PDF) or paste your notes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="module-files" className="text-xs md:text-sm font-medium">
                  Upload Module Files
                </Label>
                <label className="mt-2 flex items-center justify-center w-full h-24 md:h-32 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                  <div className="text-center p-3 md:p-4">
                    <FolderPlus className="h-6 w-6 md:h-8 md:w-8 mx-auto text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                    <p className="text-xs md:text-sm text-muted-foreground group-hover:text-primary transition-colors font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      TXT, MD, PDF files supported (multiple files allowed)
                    </p>
                  </div>
                  <input
                    id="module-files"
                    type="file"
                    accept=".txt,.md,.pdf"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs md:text-sm font-medium">Uploaded Files ({uploadedFiles.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((file) => (
                      <Badge
                        key={file.id}
                        variant="secondary"
                        className="pl-3 pr-1 py-1 text-xs flex items-center gap-2 hover-scale"
                      >
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 hover:bg-destructive/20"
                          onClick={() => removeFile(file.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="module-text" className="text-xs md:text-sm font-medium">Or Paste Module Notes</Label>
                <Textarea
                  id="module-text"
                  value={moduleText}
                  onChange={(e) => setModuleText(e.target.value)}
                  placeholder="Paste your module content here..."
                  className="mt-2 min-h-[120px] md:min-h-[150px] text-xs md:text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Generation Settings */}
          <Card className="shadow-card hover-scale transition-all">
            <CardHeader className="space-y-1 md:space-y-2 pb-3 md:pb-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg lg:text-xl">
                <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-primary animate-pulse" />
                AI Generation Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                <div>
                  <Label htmlFor="num-questions" className="text-xs md:text-sm font-medium">Number of Questions</Label>
                  <Input
                    id="num-questions"
                    type="number"
                    min="1"
                    max="50"
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(e.target.value)}
                    placeholder="e.g., 10"
                    className="mt-2 h-9 md:h-10 text-xs md:text-sm"
                  />
                </div>

                <div>
                  <Label htmlFor="question-type" className="text-xs md:text-sm font-medium">Question Type</Label>
                  <Select value={questionType} onValueChange={(v: any) => setQuestionType(v)}>
                    <SelectTrigger id="question-type" className="mt-2 h-9 md:h-10 text-xs md:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">Multiple Choice</SelectItem>
                      <SelectItem value="short-answer">Short Answer</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="difficulty" className="text-xs md:text-sm font-medium">Difficulty</Label>
                  <Select value={difficulty} onValueChange={(v: any) => setDifficulty(v)}>
                    <SelectTrigger id="difficulty" className="mt-2 h-9 md:h-10 text-xs md:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="quiz-duration" className="text-xs md:text-sm font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Duration (minutes)
                  </Label>
                  <Input
                    id="quiz-duration"
                    type="number"
                    min="5"
                    max="180"
                    value={quizDuration}
                    onChange={(e) => setQuizDuration(e.target.value)}
                    placeholder="30"
                    className="mt-2 h-9 md:h-10 text-xs md:text-sm"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="custom-prompt" className="text-xs md:text-sm font-medium">Custom Instructions (Optional)</Label>
                <Textarea
                  id="custom-prompt"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="E.g., Focus on practical applications, include code examples..."
                  className="mt-2 min-h-[60px] text-xs md:text-sm"
                />
              </div>

              <Button
                onClick={() => handleGenerateQuestions()}
                disabled={generating || (uploadedFiles.length === 0 && !moduleText.trim())}
                className="w-full gradient-primary hover:opacity-90 hover-scale h-10 md:h-11 text-xs md:text-sm font-semibold transition-all"
              >
                {generating ? (
                  <span className="animate-pulse">Generating AI Questions...</span>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                    Generate Questions with Gemini AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - AI Chat */}
        <div className="lg:col-span-1">
          <AIChatInterface
            onPromptSubmit={handleGenerateQuestions}
            isGenerating={generating}
          />
        </div>
      </div>

      {/* Generated Questions */}
      {questions.length > 0 && (
        <>
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Generated Questions ({selectedCount} selected)</CardTitle>
                  <CardDescription>
                    Review, edit, and bookmark questions below
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportJSON}>
                    <Download className="h-4 w-4 mr-1" />
                    Export JSON
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((question, index) => (
                <QuestionEditor
                  key={question.id}
                  question={question}
                  index={index}
                  onUpdate={handleUpdateQuestion}
                  onDelete={handleDeleteQuestion}
                  onToggleBookmark={handleToggleBookmark}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </CardContent>
          </Card>

          {/* Save & Share Actions */}
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Save & Share Quiz</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="quiz-title">Quiz Title</Label>
                <Input
                  id="quiz-title"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  placeholder="e.g., Module 1 Assessment"
                  className="mt-2"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSaveQuiz}
                  disabled={saving || selectedCount === 0}
                  className="flex-1 gradient-primary hover:opacity-90"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Quiz (Backend)'}
                </Button>

                <Button
                  onClick={handleBookmarkQuiz}
                  disabled={selectedCount === 0 || !quizTitle.trim()}
                  variant="outline"
                  className="flex-1"
                >
                  <Bookmark className="h-4 w-4 mr-2" />
                  Bookmark Quiz
                </Button>

                <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={selectedCount === 0 || students.length === 0}
                      className="flex-1"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Quiz
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Share Quiz with Students</DialogTitle>
                      <DialogDescription>
                        Select students to share this quiz with
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <StudentTable
                        students={students}
                        selectedStudents={selectedStudents}
                        onSelectionChange={setSelectedStudents}
                        showCheckboxes
                      />
                      <Button
                        onClick={handleShareQuiz}
                        disabled={selectedStudents.length === 0}
                        className="w-full gradient-primary"
                      >
                        Generate & Share Links ({selectedStudents.length} students)
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Links Dialog: shows generated links after share */}
      <Dialog open={linksDialogOpen} onOpenChange={setLinksDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generated Quiz Links</DialogTitle>
            <DialogDescription>Copy or download links for distribution.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {sharedLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No links available.</p>
            ) : (
              <div className="max-h-72 overflow-auto">
                <ul className="divide-y">
                  {sharedLinks.map((l, i) => (
                    <li key={`${l.email}-${i}`} className="py-2">
                      <div className="text-sm font-medium">{l.email}</div>
                      <div className="text-xs truncate">{l.link}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={copyAllLinks} disabled={sharedLinks.length === 0}>
                <Copy className="h-4 w-4 mr-2" /> Copy All
              </Button>
              <Button variant="outline" onClick={downloadLinksAsCSV} disabled={sharedLinks.length === 0}>
                <Download className="h-4 w-4 mr-2" /> Download CSV
              </Button>
              <Button onClick={() => setLinksDialogOpen(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
