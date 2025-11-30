// src/pages/CreateQuizPage.tsx
import { useState, useEffect } from 'react';
import {
  FileText,
  Sparkles,
  Download,
  Copy,
  Save,
  Share2,
  Clock,
  FolderPlus,
  X,
  Bookmark,
  PlusCircle,
  FileScan,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QuestionEditor } from '@/components/QuestionEditor';
import { AIChatInterface } from '@/components/AIChatInterface';
import { generateQuestions } from '@/services/gemini';
import { extractTextFromPDF, isPDFFile } from '@/services/pdfService';
import { quizAPI, studentsAPI, bookmarksAPI } from '@/services/api';
import { Question, Quiz, Student, QuizShare } from '@/types';
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
  size: number;
}

type ExtendedQuestion = Question & {
  section?: string;
  isSelected?: boolean;
  isBookmarked?: boolean;
};

const SHARE_BATCH_SIZE = 100;

export default function CreateQuizPage() {
  const location = useLocation();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [moduleText, setModuleText] = useState('');
  const [numQuestions, setNumQuestions] = useState('5');
  const [questionType, setQuestionType] =
    useState<'mcq' | 'short-answer' | 'mixed'>('mcq');
  const [difficulty, setDifficulty] =
    useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium');
  const [quizDuration, setQuizDuration] = useState('30');
  const [questions, setQuestions] = useState<ExtendedQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [isSavingQuiz, setIsSavingQuiz] = useState(false);
  const [isSharingQuiz, setIsSharingQuiz] = useState(false);

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');

  const [students, setStudents] = useState<Student[]>([]);
  const [sharedLinks, setSharedLinks] = useState<
    { email: string; link: string }[]
  >([]);
  const [linksDialogOpen, setLinksDialogOpen] = useState(false);

  const [currentQuizId, setCurrentQuizId] = useState<string | null>(null);
  const [shareProgress, setShareProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  const [manualPdfLoading, setManualPdfLoading] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await studentsAPI.getAll();
        setStudents(data || []);
      } catch (error) {
        console.error('Error fetching students:', error);
        toast.error('Failed to load students');
      }
    };
    fetchStudents();

    if (location.state?.editQuestion) {
      const editQ = location.state.editQuestion as ExtendedQuestion;
      setQuestions([{ ...editQ, isSelected: true }]);
    }
  }, [location]);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
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
            reader.onload = (event) =>
              resolve(event.target?.result as string);
            reader.onerror = () =>
              reject(new Error('Failed to read file'));
            reader.readAsText(file);
          });
        }

        newFiles.push({
          id: `${Date.now()}-${file.name}`,
          name: file.name,
          content,
          type: file.type,
          size: file.size,
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
    setCurrentQuizId(null);
  };

  const buildCombinedTextForAI = (): string => {
    let combined = '';

    for (const f of uploadedFiles) {
      combined += f.content + '\n\n';
    }

    if (moduleText.trim()) {
      combined += moduleText;
    }

    return combined.trim();
  };

  const handleGenerateQuestions = async (aiPrompt?: string) => {
    const combinedText = buildCombinedTextForAI();

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
        toast.error(
          'Gemini API key not configured. Please add VITE_GEMINI_API_KEY to your .env'
        );
        return;
      }

      const generatedQuestions = await generateQuestions({
        text: combinedText,
        numQuestions: num,
        type: questionType,
        difficulty,
        customPrompt: aiPrompt || customPrompt,
      });

      const extended = (generatedQuestions || []).map((q: Question) => ({
        ...(q as ExtendedQuestion),
        isSelected: true,
      }));

      setQuestions(extended);
      setCurrentQuizId(null);

      toast.success(
        `Successfully generated ${
          generatedQuestions?.length || 0
        } AI-powered questions!`
      );
    } catch (error) {
      console.error('Error generating questions:', error);
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to generate questions.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateQuestion = (updatedQuestion: ExtendedQuestion) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q))
    );
    setCurrentQuizId(null);
    toast.success('Question updated');
  };

  const handleDeleteQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setCurrentQuizId(null);
    toast.success('Question deleted');
  };

  const handleToggleBookmark = async (id: string) => {
    const question = questions.find((q) => q.id === id);
    if (!question) return;

    const newBookmarked = !question.isBookmarked;

    try {
      if (newBookmarked) {
        await bookmarksAPI.create({ question });
        toast.success('Question bookmarked');
      } else {
        toast.info('Bookmark removed from this session');
      }

      setQuestions((prev) =>
        prev.map((q) =>
          q.id === id ? { ...q, isBookmarked: newBookmarked } : q
        )
      );
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to update bookmark');
    }
  };

  const handleToggleSelect = (id: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id ? { ...q, isSelected: !q.isSelected } : q
      )
    );
  };

  const handleSectionChange = (id: string, section: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, section } : q))
    );
    setCurrentQuizId(null);
  };

  const createEmptyQuestion = (
    type: 'mcq' | 'short-answer'
  ): ExtendedQuestion => ({
    id: `manual-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    // @ts-ignore (depends on your Question type)
    question: '',
    // @ts-ignore
    answer: '',
    ...(type === 'mcq' ? { options: ['', '', '', ''] } : {}),
    type,
    isBookmarked: false,
    isSelected: true,
    section: '',
  });

  const addManualQuestion = (type: 'mcq' | 'short-answer') => {
    setQuestions((prev) => [...prev, createEmptyQuestion(type)]);
    setCurrentQuizId(null);
    toast.success(
      `Blank ${type === 'mcq' ? 'MCQ' : 'Short Answer'} question added`
    );
  };

  // ---------- FIXED PDF PARSER THAT PROPERLY HANDLES ALL 4 OPTIONS ----------

  /**
   * Robust PDF parser that ensures all 4 options are captured correctly
   * and prevents adding extra options to existing questions
   */
  const parseQuestionsFromPdfText = (text: string): ExtendedQuestion[] => {
    console.log('=== PDF PARSER STARTED ===');
    console.log('RAW PDF TEXT:', text);

    // Comprehensive text normalization
    const normalizedText = text
      .replace(/===== Page \d+ =====/gi, '')
      .replace(/Page \d+/gi, '')
      .replace(/\f/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n\s*\n/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/Answer\s*[:\-]\s*/gi, 'Answer: ')
      .replace(/([A-D])[\)\.]\s*/g, '$1. ')
      .trim();

    console.log('NORMALIZED TEXT:', normalizedText);

    const questionsParsed: ExtendedQuestion[] = [];
    const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    console.log('LINES TO PROCESS:', lines.length);

    let currentQuestion: {
      id?: string;
      questionText?: string;
      options: string[]; // Changed to array to maintain order
      correctAnswer?: string;
      lineNumber?: number;
    } = { options: [], lineNumber: 0 };

    const finalizeQuestion = () => {
      if (currentQuestion.questionText && currentQuestion.options.length >= 2) {
        // Ensure we have exactly 4 options, fill empty ones if needed
        const options = [...currentQuestion.options];
        while (options.length < 4) {
          options.push('');
        }
        
        // Take only first 4 options to prevent extra options
        const finalOptions = options.slice(0, 4);

        if (currentQuestion.questionText.length > 5) {
          const correctIndex = currentQuestion.correctAnswer 
            ? ['A', 'B', 'C', 'D'].indexOf(currentQuestion.correctAnswer.toUpperCase())
            : -1;

          const answer = correctIndex >= 0 && correctIndex < finalOptions.length
            ? finalOptions[correctIndex]
            : '';

          const q: ExtendedQuestion = {
            id: `pdf-${Date.now()}-${questionsParsed.length}`,
            // @ts-ignore
            question: currentQuestion.questionText,
            // @ts-ignore
            answer,
            options: finalOptions,
            type: 'mcq',
            isBookmarked: false,
            isSelected: true,
            section: '',
          };

          questionsParsed.push(q);
          console.log(`✅ ADDED QUESTION with ${finalOptions.filter(opt => opt).length} options:`, {
            question: currentQuestion.questionText.substring(0, 50),
            options: finalOptions,
            correctAnswer: currentQuestion.correctAnswer
          });
        }
      }
      
      // Reset for next question
      currentQuestion = { options: [], lineNumber: currentQuestion.lineNumber };
    };

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentQuestion.lineNumber = i;

      // Check for new question
      const questionMatch = line.match(/^(\d+)[\.\)]?\s+(.+)$/);
      if (questionMatch) {
        // Finalize previous question if exists
        if (currentQuestion.questionText) {
          finalizeQuestion();
        }
        
        currentQuestion.questionText = questionMatch[2].trim();
        currentQuestion.options = []; // Reset options array
        currentQuestion.correctAnswer = undefined;
        console.log(`📝 NEW QUESTION: "${currentQuestion.questionText.substring(0, 50)}..."`);
        continue;
      }

      // Check for options - FIXED: Properly capture all 4 options
      const optionMatch = line.match(/^([A-D])[\.\)]?\s+(.+)$/i);
      if (optionMatch && currentQuestion.questionText) {
        const letter = optionMatch[1].toUpperCase();
        const text = optionMatch[2].trim();
        const optionIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
        
        // Ensure we have slots for all previous options
        while (currentQuestion.options.length < optionIndex) {
          currentQuestion.options.push('');
        }
        
        // Add the option at the correct position
        if (optionIndex >= 0) {
          currentQuestion.options[optionIndex] = text;
          console.log(`   📋 OPTION ${letter} (index ${optionIndex}): ${text}`);
        }
        continue;
      }

      // Check for answer
      const answerMatch = line.match(/^Answer:\s*([A-D])/i);
      if (answerMatch && currentQuestion.questionText) {
        currentQuestion.correctAnswer = answerMatch[1].toUpperCase();
        console.log(`   ✅ ANSWER: ${currentQuestion.correctAnswer}`);
        continue;
      }

      // Handle compressed format - FIXED: Extract all options properly
      if (currentQuestion.questionText && (line.includes('A.') || line.includes('B.') || line.includes('C.') || line.includes('D.'))) {
        console.log(`   🔍 COMPRESSED LINE DETECTED: ${line}`);
        
        // Extract ALL options from compressed line using global regex
        const optionRegex = /([A-D])\.\s*([^A-D\.]*)(?=\s*(?:[A-D]\.|Answer:|$))/g;
        let optionMatch;
        
        while ((optionMatch = optionRegex.exec(line)) !== null) {
          const letter = optionMatch[1].toUpperCase();
          const text = optionMatch[2].trim();
          const optionIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
          
          if (optionIndex >= 0 && text) {
            // Ensure we have slots for all previous options
            while (currentQuestion.options.length < optionIndex) {
              currentQuestion.options.push('');
            }
            currentQuestion.options[optionIndex] = text;
            console.log(`   📋 COMPRESSED OPTION ${letter}: ${text}`);
          }
        }

        // Extract answer from compressed line
        const compressedAnswer = line.match(/Answer:\s*([A-D])/i);
        if (compressedAnswer && !currentQuestion.correctAnswer) {
          currentQuestion.correctAnswer = compressedAnswer[1].toUpperCase();
        }
      }

      // Finalize if we detect next question
      const nextLineQuestion = i < lines.length - 1 ? lines[i + 1].match(/^\d+[\.\)]?\s+/) : false;
      if (nextLineQuestion && currentQuestion.questionText) {
        console.log(`   ⏩ NEXT QUESTION DETECTED, FINALIZING CURRENT`);
        finalizeQuestion();
      }
    }

    // Finalize the last question
    if (currentQuestion.questionText) {
      finalizeQuestion();
    }

    console.log('=== PDF PARSER COMPLETED ===');
    console.log(`FOUND ${questionsParsed.length} QUESTIONS`);
    questionsParsed.forEach((q, index) => {
      console.log(`Q${index + 1}: ${q.question?.substring(0, 50)}... - Options: ${q.options?.filter(opt => opt).length}`);
    });
    
    return questionsParsed;
  };

  // Alternative parser for edge cases - FIXED to handle all 4 options
  const parseCompressedTextFormat = (text: string): ExtendedQuestion[] => {
    console.log('🔄 USING ALTERNATIVE PARSER FOR COMPRESSED TEXT');
    
    const questionsParsed: ExtendedQuestion[] = [];
    
    // Handle fully compressed text (everything in one block)
    const questionBlocks = text.split(/(?=\d+[\.\)]?\s+)/).filter(block => block.trim());
    
    questionBlocks.forEach((block, index) => {
      console.log(`Processing compressed block ${index + 1}:`, block.substring(0, 100) + '...');
      
      // Extract question
      const questionMatch = block.match(/^\d+[\.\)]?\s*([^A-D]*?)(?=[A-D][\.\)]|Answer:|$)/);
      if (!questionMatch) return;
      
      const questionText = questionMatch[1].trim();
      
      // Extract all options using improved regex
      const options: string[] = [];
      const optionRegex = /([A-D])[\.\)]?\s*([^A-D]*?)(?=(?:[A-D][\.\)]|Answer:|$))/g;
      let optionMatch;
      
      while ((optionMatch = optionRegex.exec(block)) !== null) {
        const letter = optionMatch[1].toUpperCase();
        const text = optionMatch[2].trim();
        const optionIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
        
        if (optionIndex >= 0 && text) {
          // Ensure we have slots for all previous options
          while (options.length < optionIndex) {
            options.push('');
          }
          options[optionIndex] = text;
        }
      }
      
      // Ensure we have exactly 4 options
      while (options.length < 4) {
        options.push('');
      }
      const finalOptions = options.slice(0, 4);
      
      // Extract answer
      const answerMatch = block.match(/Answer:\s*([A-D])/gi);
      const correctAnswer = answerMatch ? answerMatch[0].match(/[A-D]/i)?.[0].toUpperCase() : '';
      
      // Create question if valid
      if (questionText && finalOptions.filter(opt => opt).length >= 2) {
        const correctIndex = correctAnswer ? ['A', 'B', 'C', 'D'].indexOf(correctAnswer) : -1;
        const answer = correctIndex >= 0 && correctIndex < finalOptions.length ? finalOptions[correctIndex] : '';
        
        const q: ExtendedQuestion = {
          id: `pdf-compressed-${Date.now()}-${index}`,
          // @ts-ignore
          question: questionText,
          // @ts-ignore
          answer,
          options: finalOptions,
          type: 'mcq',
          isBookmarked: false,
          isSelected: true,
          section: '',
        };
        
        questionsParsed.push(q);
        console.log(`✅ ALTERNATIVE PARSER ADDED QUESTION with ${finalOptions.filter(opt => opt).length} options`);
      }
    });
    
    return questionsParsed;
  };

  const handleManualPdfUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    if (!isPDFFile(file)) {
      toast.error('Please upload a PDF file with questions.');
      return;
    }

    try {
      setManualPdfLoading(true);
      toast.info(`Reading questions from ${file.name}...`);

      const text = await extractTextFromPDF(file);
      console.log('=== PDF EXTRACTION COMPLETE ===');
      console.log('EXTRACTED TEXT LENGTH:', text.length);
      
      let parsedQuestions = parseQuestionsFromPdfText(text);

      // If main parser finds nothing, try alternative approach
      if (parsedQuestions.length === 0) {
        console.log('🔄 Main parser found 0 questions, trying alternative parser...');
        parsedQuestions = parseCompressedTextFormat(text);
      }

      if (parsedQuestions.length === 0) {
        console.error('❌ ALL PARSERS FAILED - No questions detected');
        console.error('TEXT CONTENT FOR DEBUGGING:', text);
        toast.error(
          `Could not detect any questions in the PDF. Please check:
          • Questions are numbered (1., 2., etc.)
          • Options use A., B., C., D.
          • Answers use "Answer: A" format
          Check browser console for detailed analysis.`
        );
        return;
      }

      // FIXED: Prevent adding extra options by replacing existing questions
      // instead of appending to them
      setQuestions((prev) => {
        // Remove any existing PDF questions to avoid duplicates
        const nonPdfQuestions = prev.filter(q => !q.id?.includes('pdf-'));
        return [...nonPdfQuestions, ...parsedQuestions];
      });
      
      setCurrentQuizId(null);

      toast.success(`✅ Imported ${parsedQuestions.length} question(s) from PDF`);
    } catch (err) {
      console.error('❌ Error importing questions from PDF:', err);
      toast.error('Failed to extract questions from PDF. Please try another file.');
    } finally {
      setManualPdfLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  // ---------------------------------------------------------------------

  const handleExportJSON = () => {
    const selectedQuestions = questions.filter((q) => q.isSelected);
    if (selectedQuestions.length === 0) {
      toast.error('No selected questions to export');
      return;
    }
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
    const selectedQuestions = questions.filter((q) => q.isSelected);
    if (selectedQuestions.length === 0) {
      toast.error('No selected questions to copy');
      return;
    }
    navigator.clipboard.writeText(
      JSON.stringify(selectedQuestions, null, 2)
    );
    toast.success('Questions copied to clipboard');
  };

  const saveQuizToServer = async (
    title: string,
    selectedQuestions: ExtendedQuestion[]
  ) => {
    const duration = parseInt(quizDuration, 10);
    if (isNaN(duration) || duration <= 0) {
      throw new Error('Invalid duration value');
    }

    const basePayload: Partial<Quiz> = {
      title,
      questions: selectedQuestions as any,
      createdAt: new Date().toISOString(),
      numQuestions: selectedQuestions.length,
      questionType,
      duration,
      difficulty,
    };

    const quizPayload: Partial<Quiz> = currentQuizId
      ? { ...(basePayload as any), id: currentQuizId }
      : basePayload;

    const saveRes = await quizAPI.save(quizPayload as Quiz);
    const quizId =
      saveRes.quizId ||
      (saveRes.quiz &&
        (saveRes.quiz._id || saveRes.quiz.id || saveRes.quizId));

    if (!quizId) {
      throw new Error('Server did not return quizId');
    }

    setCurrentQuizId(quizId);
    return quizId;
  };

  const handleSaveQuiz = async () => {
    const selectedQuestions = questions.filter((q) => q.isSelected);

    if (selectedQuestions.length === 0) {
      toast.error('Please select at least one question');
      return;
    }

    if (!quizTitle.trim()) {
      toast.error('Please enter a quiz title');
      return;
    }

    setIsSavingQuiz(true);
    try {
      const quizId = await saveQuizToServer(
        quizTitle,
        selectedQuestions
      );
      toast.success('Quiz saved successfully!');
      return quizId;
    } catch (error: any) {
      console.error('Error saving quiz:', error);
      toast.error(error?.message || 'Failed to save quiz');
      throw error;
    } finally {
      setIsSavingQuiz(false);
    }
  };

  const handleBookmarkQuiz = async () => {
    const selectedQuestions = questions.filter((q) => q.isSelected);

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
          questions: selectedQuestions as any,
          numQuestions: selectedQuestions.length,
          questionType,
          duration: parseInt(quizDuration, 10),
          difficulty,
        },
      });

      toast.success('Quiz bookmarked successfully!');
    } catch (error) {
      console.error('Error bookmarking quiz:', error);
      toast.error('Failed to bookmark quiz');
    }
  };

  const handleShareQuiz = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select at least one student');
      return;
    }

    const selectedQuestions = questions.filter((q) => q.isSelected);
    if (selectedQuestions.length === 0) {
      toast.error('Please select at least one question');
      return;
    }

    if (!quizTitle.trim()) {
      toast.error('Please enter a quiz title before sharing');
      return;
    }

    setIsSharingQuiz(true);
    setShareProgress(null);

    try {
      // Ensure quiz is saved (create or update)
      let quizId = currentQuizId;
      if (!quizId) {
        quizId = await saveQuizToServer(quizTitle, selectedQuestions);
      }

      // Resolve selected student IDs to emails
      let studentEmails = (selectedStudents || [])
        .map((s) => {
          if (typeof s === 'string' && s.includes('@'))
            return s.trim();

          try {
            const parsed = JSON.parse(String(s));
            if (parsed && typeof parsed === 'object' && parsed.email) {
              return String(parsed.email).trim();
            }
          } catch {
            // ignore
          }

          const found = students.find(
            (st) =>
              (st as any)._id === s ||
              (st as any).id === s ||
              st.email === s
          );
          return found ? found.email : '';
        })
        .filter(Boolean);

      studentEmails = Array.from(new Set(studentEmails)).filter(
        (email) => typeof email === 'string' && email.includes('@')
      );

      if (studentEmails.length === 0) {
        toast.error('No valid student emails to share to');
        return;
      }

      const total = studentEmails.length;
      const allLinks: Array<{ email: string; link: string }> = [];

      for (let i = 0; i < studentEmails.length; i += SHARE_BATCH_SIZE) {
        const batchEmails = studentEmails.slice(
          i,
          i + SHARE_BATCH_SIZE
        );

        setShareProgress({
          current: Math.min(i + SHARE_BATCH_SIZE, total),
          total,
        });

        const sharePayload: QuizShare = {
          quizId,
          studentEmails: batchEmails,
          links: [],
          forceResend: true,
        };

        const result: any = await quizAPI.share(sharePayload);
        const linksFromResult = Array.isArray(result.links)
          ? result.links
          : [];

        linksFromResult.forEach((l: any) => {
          if (l && l.email && l.link) {
            allLinks.push({ email: l.email, link: l.link });
          }
        });
      }

      setSharedLinks(allLinks);

      if (allLinks.length === 0) {
        toast(
          'Share completed but no links were returned. Check server response in console/network.'
        );
        console.warn(
          'Share result had no links. Check backend /quiz/share response.'
        );
      } else {
        toast.success(
          `Quiz links generated for ${
            allLinks.length
          } student(s) in ${Math.ceil(
            total / SHARE_BATCH_SIZE
          )} batch(es).`
        );
        setLinksDialogOpen(true);
      }

      setShareDialogOpen(false);
      setShareProgress(null);
    } catch (err: any) {
      console.error('Error sharing quiz:', err);

      if (err?.response?.data) {
        const data = err.response.data;
        console.error('Server response:', data);
        const serverMsg =
          data?.message ||
          (Array.isArray(data?.failedValidation) &&
            data.failedValidation
              .map(
                (f: any) =>
                  `${f.email || f}: ${f.reason}`
              )
              .join('; ')) ||
          (Array.isArray(data?.failedSend) &&
            data.failedSend
              .map(
                (f: any) =>
                  f.reason || JSON.stringify(f)
              )
              .join('; ')) ||
          JSON.stringify(data);
        toast.error(`Share failed: ${serverMsg}`);
      } else {
        toast.error(err?.message || 'Failed to share quiz');
      }
    } finally {
      setIsSharingQuiz(false);
      setShareProgress(null);
    }
  };

  const selectedCount = questions.filter((q) => q.isSelected).length;

  const copyAllLinks = async () => {
    if (sharedLinks.length === 0) {
      toast.error('No links to copy');
      return;
    }
    const text = sharedLinks
      .map((l) => `${l.email}: ${l.link}`)
      .join('\n');
    await navigator.clipboard.writeText(text);
    toast.success('Links copied to clipboard');
  };

  const downloadLinksAsCSV = () => {
    if (sharedLinks.length === 0) {
      toast.error('No links to download');
      return;
    }
    const csv = sharedLinks
      .map((l) => `${l.email},${l.link}`)
      .join('\n');
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
          Upload module content, generate AI-powered questions, import
          existing PDFs, or add your own manually.
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
                <Label
                  htmlFor="module-files"
                  className="text-xs md:text-sm font-medium"
                >
                  Upload Module Files
                </Label>
                <label className="mt-2 flex items-center justify-center w-full h-24 md:h-32 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                  <div className="text-center p-3 md:p-4">
                    <FolderPlus className="h-6 w-6 md:h-8 md:w-8 mx-auto text-muted-foreground mb-2 group-hover:text-primary transition-colors" />
                    <p className="text-xs md:text-sm text-muted-foreground group-hover:text-primary transition-colors font-medium">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      TXT, MD, PDF files supported (multiple files
                      allowed)
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
                  <Label className="text-xs md:text-sm font-medium">
                    Uploaded Files ({uploadedFiles.length})
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {uploadedFiles.map((file) => (
                      <Badge
                        key={file.id}
                        variant="secondary"
                        className="pl-3 pr-1 py-1 text-xs flex items-center gap-2 hover-scale"
                      >
                        <span className="truncate max-w-[150px]">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {(
                            file.size /
                            (1024 * 1024)
                          ).toFixed(1)}
                          MB
                        </span>
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
                <Label
                  htmlFor="module-text"
                  className="text-xs md:text-sm font-medium"
                >
                  Or Paste Module Notes
                </Label>
                <Textarea
                  id="module-text"
                  value={moduleText}
                  onChange={(e) => {
                    setModuleText(e.target.value);
                    setCurrentQuizId(null);
                  }}
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
                  <Label
                    htmlFor="num-questions"
                    className="text-xs md:text-sm font-medium"
                  >
                    Number of Questions
                  </Label>
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
                  <Label
                    htmlFor="question-type"
                    className="text-xs md:text-sm font-medium"
                  >
                    Question Type
                  </Label>
                  <Select
                    value={questionType}
                    onValueChange={(v: any) => setQuestionType(v)}
                  >
                    <SelectTrigger
                      id="question-type"
                      className="mt-2 h-9 md:h-10 text-xs md:text-sm"
                    >
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">
                        Multiple Choice
                      </SelectItem>
                      <SelectItem value="short-answer">
                        Short Answer
                      </SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label
                    htmlFor="difficulty"
                    className="text-xs md:text-sm font-medium"
                  >
                    Difficulty
                  </Label>
                  <Select
                    value={difficulty}
                    onValueChange={(v: any) => setDifficulty(v)}
                  >
                    <SelectTrigger
                      id="difficulty"
                      className="mt-2 h-9 md:h-10 text-xs md:text-sm"
                    >
                      <SelectValue placeholder="Select difficulty" />
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
                  <Label
                    htmlFor="quiz-duration"
                    className="text-xs md:text-sm font-medium flex items-center gap-1"
                  >
                    <Clock className="h-3 w-3" />
                    Duration (minutes)
                  </Label>
                  <Input
                    id="quiz-duration"
                    type="number"
                    min="5"
                    max="180"
                    value={quizDuration}
                    onChange={(e) =>
                      setQuizDuration(e.target.value)
                    }
                    placeholder="30"
                    className="mt-2 h-9 md:h-10 text-xs md:text-sm"
                  />
                </div>
              </div>

              <div>
                <Label
                  htmlFor="custom-prompt"
                  className="text-xs md:text-sm font-medium"
                >
                  Custom Instructions (Optional)
                </Label>
                <Textarea
                  id="custom-prompt"
                  value={customPrompt}
                  onChange={(e) =>
                    setCustomPrompt(e.target.value)
                  }
                  placeholder="E.g., Focus on practical applications, include code examples..."
                  className="mt-2 min-h-[60px] text-xs md:text-sm"
                />
              </div>

              <Button
                onClick={() => handleGenerateQuestions()}
                disabled={
                  generating ||
                  (uploadedFiles.length === 0 &&
                    !moduleText.trim())
                }
                className="w-full gradient-primary hover:opacity-90 hover-scale h-10 md:h-11 text-xs md:text-sm font-semibold transition-all"
              >
                {generating ? (
                  <span className="animate-pulse">
                    Generating AI Questions...
                  </span>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 md:h-5 md:w-5 mr-2" />
                    Generate Questions with Gemini AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Manual Question Creation + PDF Import */}
          <Card className="shadow-card hover-scale transition-all">
            <CardHeader className="space-y-1 md:space-y-2 pb-3 md:pb-4">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg lg:text-xl">
                <PlusCircle className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                Manual Questions
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Add your own questions without using AI, or import
                existing question papers (PDF – Option A pattern).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Manual add buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => addManualQuestion('mcq')}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add MCQ Question
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => addManualQuestion('short-answer')}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Short Answer Question
                </Button>
              </div>

              {/* PDF import (Option A) */}
              <div className="pt-2 border-t mt-2 space-y-2">
                <Label className="text-xs md:text-sm font-medium flex items-center gap-2">
                  <FileScan className="h-4 w-4 text-primary" />
                  Import Questions from PDF (Option A Format)
                </Label>
                <p className="text-[11px] md:text-xs text-muted-foreground">
                  Expected pattern inside PDF:
                  <br />
                  <code className="font-mono">
                    1. Question text...
                    <br />
                    A. Option 1
                    <br />
                    B. Option 2
                    <br />
                    C. Option 3
                    <br />
                    D. Option 4
                    <br />
                    Answer: A
                  </code>
                </p>
                <label className="mt-1 flex items-center justify-center w-full h-20 md:h-24 border border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group">
                  <div className="text-center p-2">
                    <FileScan className="h-6 w-6 mx-auto text-muted-foreground mb-1 group-hover:text-primary transition-colors" />
                    <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
                      {manualPdfLoading
                        ? 'Processing PDF...'
                        : 'Click to upload question paper (PDF)'}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleManualPdfUpload}
                    className="hidden"
                    disabled={manualPdfLoading}
                  />
                </label>
              </div>
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

      {/* Questions */}
      {questions.length > 0 && (
        <>
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle>
                    Questions ({selectedCount} selected)
                  </CardTitle>
                  <CardDescription>
                    Review, edit, assign sections, and bookmark questions
                    below
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportJSON}
                    disabled={selectedCount === 0}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyToClipboard}
                    disabled={selectedCount === 0}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {questions.map((question, index) => (
                <div
                  key={question.id}
                  className="border rounded-lg p-3 md:p-4 space-y-3 bg-background/40"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Q{index + 1}</Badge>
                      <span className="text-xs md:text-sm text-muted-foreground uppercase">
                        {question.type === 'mcq'
                          ? 'MCQ'
                          : 'Short Answer'}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                      <Label className="text-xs md:text-sm">
                        Section
                      </Label>
                      <Input
                        value={question.section || ''}
                        onChange={(e) =>
                          handleSectionChange(
                            question.id,
                            e.target.value
                          )
                        }
                        placeholder="e.g., Section A, Part 1..."
                        className="h-8 md:h-9 text-xs md:text-sm max-w-xs"
                      />
                    </div>
                  </div>

                  <QuestionEditor
                    question={question}
                    index={index}
                    onUpdate={handleUpdateQuestion}
                    onDelete={handleDeleteQuestion}
                    onToggleBookmark={handleToggleBookmark}
                    onToggleSelect={handleToggleSelect}
                  />
                </div>
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
                  onChange={(e) => {
                    setQuizTitle(e.target.value);
                    setCurrentQuizId(null);
                  }}
                  placeholder="e.g., Module 1 Assessment"
                  className="mt-2"
                />
              </div>

              <div className="flex flex-col md:flex-row gap-3">
                <Button
                  onClick={handleSaveQuiz}
                  disabled={isSavingQuiz || selectedCount === 0}
                  className="flex-1 gradient-primary hover:opacity-90"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingQuiz
                    ? 'Saving Quiz...'
                    : 'Save Quiz (Backend)'}
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

                <Dialog
                  open={shareDialogOpen}
                  onOpenChange={setShareDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={
                        selectedCount === 0 || students.length === 0
                      }
                      className="flex-1"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Quiz
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        Share Quiz with Students
                      </DialogTitle>
                      <DialogDescription>
                        Select students to share this quiz with. Unique
                        links will be generated and sent to their email.
                        Delivery time depends on your email provider.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 space-y-4">
                      <StudentTable
                        students={students}
                        selectedStudents={selectedStudents}
                        onSelectionChange={setSelectedStudents}
                        showCheckboxes
                      />
                      {shareProgress && (
                        <p className="text-xs text-muted-foreground">
                          Sharing... {shareProgress.current}/
                          {shareProgress.total} students processed
                        </p>
                      )}
                      <div className="flex justify-end">
                        <Button
                          onClick={handleShareQuiz}
                          disabled={
                            selectedStudents.length === 0 ||
                            isSharingQuiz
                          }
                          className="w-full sm:w-auto gradient-primary"
                        >
                          {isSharingQuiz
                            ? 'Generating & Sending Links...'
                            : `Generate & Share Links (${selectedStudents.length} students)`}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Links Dialog */}
      <Dialog open={linksDialogOpen} onOpenChange={setLinksDialogOpen}>
        <DialogContent className="sm:max-w-2xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Generated Quiz Links</DialogTitle>
            <DialogDescription>
              Copy or download links for distribution to your students.
              Email delivery can still be delayed by your mail provider;
              you can send these links manually if needed.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            {sharedLinks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No links available.
              </p>
            ) : (
              <div className="max-h-72 overflow-auto border rounded-md p-2">
                <ul className="divide-y">
                  {sharedLinks.map((l, i) => (
                    <li
                      key={`${l.email}-${i}`}
                      className="py-2 space-y-1"
                    >
                      <div className="text-sm font-medium">
                        {l.email}
                      </div>
                      <div className="text-xs truncate">
                        {l.link}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="outline"
                onClick={copyAllLinks}
                disabled={sharedLinks.length === 0}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy All
              </Button>
              <Button
                variant="outline"
                onClick={downloadLinksAsCSV}
                disabled={sharedLinks.length === 0}
              >
                <Download className="h-4 w-4 mr-2" /> Download CSV
              </Button>
              <Button onClick={() => setLinksDialogOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}