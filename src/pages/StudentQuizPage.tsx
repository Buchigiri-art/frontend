// src/pages/StudentQuizPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/use-toast';
import {
  Loader2, Clock, CheckCircle2, AlertCircle, Maximize2,
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const MAX_WARNINGS = 3;        // max allowed violations before auto-submit
const GRACE_SECONDS = 10;      // time to return to fullscreen/focus

interface Question {
  id: string;
  type: 'mcq' | 'short-answer';
  question: string;
  options?: string[];
}

interface Quiz {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  numQuestions?: number;
  questions?: Question[];
}

export default function StudentQuizPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [email, setEmail] = useState('');

  // Student info form
  const [showInfoForm, setShowInfoForm] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentUSN, setStudentUSN] = useState('');
  const [studentBranch, setStudentBranch] = useState('');
  const [studentYear, setStudentYear] = useState('');
  const [studentSemester, setStudentSemester] = useState('');

  // Quiz state
  const [quizStarted, setQuizStarted] = useState(false);
  const [attemptId, setAttemptId] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Anti-cheat / monitoring
  const [warningCount, setWarningCount] = useState(0);
  const [isCheated, setIsCheated] = useState(false);
  const localWarningsRef = useRef<number>(0);
  const lastWarnAtRef = useRef<number>(0);
  const monitoringRef = useRef<boolean>(false);
  const autoSubmitTimeoutRef = useRef<number | null>(null);

  const tokenRef = useRef<string | undefined>(token);
  const attemptIdRef = useRef<string>('');
  attemptIdRef.current = attemptId;

  useEffect(() => {
    tokenRef.current = token;
    fetchQuizData();
    return () => {
      removeMonitoringListeners();
      restoreBodyStyles();
      clearAutoSubmitTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Timer
  useEffect(() => {
    if (quizStarted && timeLeft > 0 && !quizSubmitted) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSubmitQuiz();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [quizStarted, timeLeft, quizSubmitted]);

  const fetchQuizData = async () => {
    try {
      const res = await axios.get(`${API_URL}/student-quiz/attempt/${token}`);
      const data = res.data;

      if (data.alreadySubmitted) {
        toast({
          title: 'Quiz Already Submitted',
          description: 'You have already completed this quiz.',
          variant: 'destructive',
        });
        setQuizSubmitted(true);
        setLoading(false);
        return;
      }

      setQuiz(data.quiz);
      setEmail(data.studentInfo?.email || data.email || '');
      setWarningCount(data.warningCount || 0);
      localWarningsRef.current = data.warningCount || 0;

      if (data.hasStarted && data.attemptId) {
        setAttemptId(data.attemptId);
        setQuizStarted(true);
        setAnswers(new Array(data.quiz.questions.length).fill(''));
        setTimeLeft((data.quiz.duration || 30) * 60);
        setStudentName(data.studentInfo.name);
        setStudentUSN(data.studentInfo.usn);
        applyBodyStyles();
        enableMonitoring();
      } else {
        setShowInfoForm(true);
      }
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching quiz:', err);
      toast({
        title: 'Error',
        description: err?.response?.data?.message || 'Failed to load quiz',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  // Start quiz: save attempt and enable monitoring
  const handleStartQuiz = async () => {
    if (!studentName.trim() || !studentUSN.trim() || !studentBranch || !studentYear || !studentSemester) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/student-quiz/attempt/start`, {
        token,
        studentName,
        studentUSN,
        studentBranch,
        studentYear,
        studentSemester,
      });

      setAttemptId(res.data.attemptId);
      setQuiz(res.data.quiz);
      setAnswers(new Array(res.data.quiz.questions.length).fill(''));
      setTimeLeft((res.data.quiz.duration || 30) * 60);
      setQuizStarted(true);
      setShowInfoForm(false);

      applyBodyStyles();
      await tryEnterFullscreen(3, 300);
      enableMonitoring();

      toast({
        title: 'Quiz Started',
        description: 'Quiz is being monitored. Focus on this window and stay in fullscreen.',
      });
    } catch (err: any) {
      console.error('Error starting quiz:', err);
      toast({
        title: 'Error',
        description: err?.response?.data?.message || 'Failed to start quiz',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Submit quiz to server (normal submit)
  const handleSubmitQuiz = async () => {
    if (submitting || quizSubmitted) return;

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/student-quiz/attempt/submit`, {
        attemptId: attemptIdRef.current || attemptId,
        answers,
      });

      removeMonitoringListeners();
      restoreBodyStyles();
      clearAutoSubmitTimer();
      setQuizSubmitted(true);
      toast({
        title: 'Quiz Submitted',
        description: `You scored ${res.data.results.totalMarks}/${res.data.results.maxMarks} (${res.data.results.percentage}%)`,
      });
    } catch (err: any) {
      console.error('Error submitting quiz:', err);
      toast({
        title: 'Error',
        description: err?.response?.data?.message || 'Failed to submit quiz',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  // Auto-submit as cheat (called after 3 warnings or after 10s grace)
  const handleAutoSubmitAsCheat = async (reason = 'violation:auto-submit') => {
    if (quizSubmitted) return;

    try {
      // best-effort flag
      await axios.post(`${API_URL}/student-quiz/attempt/flag`, { token, reason });
    } catch (err) {
      console.warn('Flagging failed during auto-submit:', err);
    }

    setIsCheated(true);

    try {
      await axios.post(`${API_URL}/student-quiz/attempt/submit`, {
        attemptId: attemptIdRef.current || attemptId,
        answers,
      });
    } catch (err) {
      console.warn('Auto-submit failed:', err);
    }

    removeMonitoringListeners();
    restoreBodyStyles();
    clearAutoSubmitTimer();
    setQuizSubmitted(true);

    toast({
      title: 'Quiz Blocked',
      description: 'Repeated violations detected. The quiz was auto-submitted.',
      variant: 'destructive',
    });
  };

  const handleAnswerChange = (value: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = value;
    setAnswers(newAnswers);
  };

  // ----------------- FULLSCREEN HELPERS -----------------
  const tryEnterFullscreen = async (retries = 3, delayMs = 300): Promise<boolean> => {
    const attemptFS = async (): Promise<boolean> => {
      try {
        if (document.fullscreenElement) return true;
        const elem: any = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
          return !!document.fullscreenElement;
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
          return !!document.fullscreenElement;
        }
      } catch {
        // ignore
      }
      return false;
    };

    for (let i = 0; i < retries; i++) {
      const ok = await attemptFS();
      if (ok) return true;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
  };

  // ----------------- AUTO-SUBMIT TIMER HELPERS -----------------
  const scheduleAutoSubmit = (reason: string) => {
    clearAutoSubmitTimer();
    autoSubmitTimeoutRef.current = window.setTimeout(() => {
      handleAutoSubmitAsCheat(`${reason}:timeout-${GRACE_SECONDS}s`);
    }, GRACE_SECONDS * 1000);
  };

  const clearAutoSubmitTimer = () => {
    if (autoSubmitTimeoutRef.current !== null) {
      window.clearTimeout(autoSubmitTimeoutRef.current);
      autoSubmitTimeoutRef.current = null;
    }
  };

  // ----------------- STRICT MONITORING -----------------
  const enableMonitoring = () => {
    if (monitoringRef.current) return;
    monitoringRef.current = true;

    document.addEventListener('visibilitychange', onVisibilityChange, true);
    window.addEventListener('blur', onWindowBlur, true);
    window.addEventListener('focus', onWindowFocus, true);
    document.addEventListener('fullscreenchange', onFullscreenChange, true);
    window.addEventListener('copy', onCopyAttempt, true);
    window.addEventListener('beforeunload', onBeforeUnload, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('keydown', onKeyDown, true);

    applyBodyStyles();
  };

  const removeMonitoringListeners = () => {
    monitoringRef.current = false;

    document.removeEventListener('visibilitychange', onVisibilityChange, true);
    window.removeEventListener('blur', onWindowBlur, true);
    window.removeEventListener('focus', onWindowFocus, true);
    document.removeEventListener('fullscreenchange', onFullscreenChange, true);
    window.removeEventListener('copy', onCopyAttempt, true);
    window.removeEventListener('beforeunload', onBeforeUnload, true);
    document.removeEventListener('contextmenu', onContextMenu, true);
    window.removeEventListener('keydown', onKeyDown, true);
  };

  // Send flag and update warning count (local + server)
  const sendFlag = async (reason: string): Promise<number> => {
    const now = Date.now();
    if (now - (lastWarnAtRef.current || 0) < 500) {
      return localWarningsRef.current;
    }
    lastWarnAtRef.current = now;

    // increment local first
    localWarningsRef.current = localWarningsRef.current + 1;
    setWarningCount(localWarningsRef.current);
    let count = localWarningsRef.current;

    try {
      const res = await axios.post(`${API_URL}/student-quiz/attempt/flag`, { token, reason });
      if (typeof res.data.warningCount === 'number') {
        count = res.data.warningCount;
        localWarningsRef.current = count;
        setWarningCount(count);
      }
    } catch (err) {
      console.warn('Flag send failed:', err);
    }

    return count;
  };

  // Handle any violation (tab switch, minimize, copy, etc.)
  const handleViolation = (reason: string, withGraceTimer: boolean) => {
    if (!quizStarted || quizSubmitted) return;

    (async () => {
      const count = await sendFlag(reason);

      if (count >= MAX_WARNINGS) {
        await handleAutoSubmitAsCheat(`max-warnings:${reason}`);
        return;
      }

      const remaining = MAX_WARNINGS - count;

      if (withGraceTimer) {
        scheduleAutoSubmit(reason);
        toast({
          title: 'Focus lost / fullscreen exited',
          description: `Warning ${count}/${MAX_WARNINGS}. Return to fullscreen within ${GRACE_SECONDS} seconds or the quiz will auto-submit. Remaining warnings: ${remaining}.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Violation detected',
          description: `Warning ${count}/${MAX_WARNINGS}. Remaining warnings: ${remaining}.`,
          variant: 'default',
        });
      }
    })();
  };

  // Event handlers

  // Visibility change: tab hidden / minimized / switched
  const onVisibilityChange = () => {
    if (document.hidden || document.visibilityState !== 'visible') {
      handleViolation('visibility:hidden', true);
    } else {
      // back to visible -> cancel pending auto-submit
      clearAutoSubmitTimer();
    }
  };

  const onWindowBlur = () => {
    handleViolation('window:blur', true);
  };

  const onWindowFocus = () => {
    clearAutoSubmitTimer();
  };

  const onFullscreenChange = () => {
    const isFs = !!document.fullscreenElement;
    if (!isFs) {
      handleViolation('fullscreen:exited', true);
    } else {
      clearAutoSubmitTimer();
    }
  };

  const onCopyAttempt = (e: ClipboardEvent) => {
    if (quizStarted && !quizSubmitted) {
      handleViolation('clipboard:copy', false);
    }
  };

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (quizStarted && !quizSubmitted) {
      handleViolation('attempt:beforeunload', true);
      e.preventDefault();
      e.returnValue = '';
    }
  };

  const onContextMenu = (e: Event) => {
    e.preventDefault();
    if (quizStarted && !quizSubmitted) {
      handleViolation('contextmenu', false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const key = e.key?.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    if (key === 'f12') {
      e.preventDefault();
      handleViolation('key:f12', false);
    }

    if (ctrl && shift && (key === 'i' || key === 'c' || key === 'j')) {
      e.preventDefault();
      handleViolation(`key:ctrl-shift-${key}`, false);
    }

    if (ctrl && key === 'u') {
      e.preventDefault();
      handleViolation('key:ctrl-u', false);
    }

    if (ctrl && key === 's') {
      e.preventDefault();
      handleViolation('key:ctrl-s', false);
    }
  };

  // ----------------- BODY STYLE HELPERS -----------------
  const applyBodyStyles = () => {
    try {
      const body = document.body;
      if (!body.dataset.prevUserSelect) body.dataset.prevUserSelect = body.style.userSelect || '';
      if (!body.dataset.prevTouchAction) body.dataset.prevTouchAction = body.style.touchAction || '';

      body.style.userSelect = 'none';
      body.style.touchAction = 'manipulation';
    } catch {
      // ignore
    }
  };

  const restoreBodyStyles = () => {
    try {
      const body = document.body;
      if (body.dataset.prevUserSelect !== undefined) {
        body.style.userSelect = body.dataset.prevUserSelect;
      }
      if (body.dataset.prevTouchAction !== undefined) {
        body.style.touchAction = body.dataset.prevTouchAction;
      }
      delete body.dataset.prevUserSelect;
      delete body.dataset.prevTouchAction;
    } catch {
      // ignore
    }
  };

  // ----------------- RENDER HELPERS -----------------
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // UI: loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // UI: blocked / submitted
  if (quizSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            {isCheated ? (
              <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            ) : (
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            )}
            <CardTitle>{isCheated ? 'Quiz Blocked' : 'Quiz Submitted'}</CardTitle>
            <CardDescription>
              {isCheated
                ? 'Your quiz was auto-submitted due to repeated violations. Contact your instructor if this was a mistake.'
                : 'Thank you — your quiz has been submitted.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // UI: info form before starting
  if (showInfoForm && quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{quiz.title}</CardTitle>
            <CardDescription>{quiz.description || 'Enter details to start the quiz'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input id="name" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Full name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usn">USN *</Label>
              <Input id="usn" value={studentUSN} onChange={(e) => setStudentUSN(e.target.value.toUpperCase())} placeholder="USN" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch *</Label>
              <Select value={studentBranch} onValueChange={setStudentBranch}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CSE">CSE</SelectItem>
                  <SelectItem value="ISE">ISE</SelectItem>
                  <SelectItem value="ECE">ECE</SelectItem>
                  <SelectItem value="EEE">EEE</SelectItem>
                  <SelectItem value="ME">ME</SelectItem>
                  <SelectItem value="CE">CE</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Year *</Label>
                <Select value={studentYear} onValueChange={setStudentYear}>
                  <SelectTrigger><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1</SelectItem>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Semester *</Label>
                <Select value={studentSemester} onValueChange={setStudentSemester}>
                  <SelectTrigger><SelectValue placeholder="Sem" /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <SelectItem key={s} value={s.toString()}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Monitoring is enabled. If you minimize, switch tabs, or exit fullscreen, you&apos;ll get a warning and have {GRACE_SECONDS} seconds to return.
                After {MAX_WARNINGS} warnings, the quiz will be auto-submitted.
              </p>
            </div>

            <Button onClick={handleStartQuiz} className="w-full" disabled={loading}>
              {loading ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...</> : 'Start Quiz'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // UI: active quiz
  if (quizStarted && quiz?.questions) {
    const question = quiz.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;
    const showFullscreenButton = !document.fullscreenElement;

    return (
      <div className="min-h-screen bg-background">
        <div className="bg-card border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-xl font-bold">{quiz.title}</h1>
                <p className="text-sm text-muted-foreground">{studentName} ({studentUSN})</p>
                <p className="text-xs text-muted-foreground">Warnings: {warningCount} / {MAX_WARNINGS}</p>
              </div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Clock className={`h-5 w-5 ${timeLeft < 300 ? 'text-destructive' : 'text-primary'}`} />
                <span className={timeLeft < 300 ? 'text-destructive' : 'text-foreground'}>
                  {formatTime(timeLeft)}
                </span>
                {showFullscreenButton && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const ok = await tryEnterFullscreen(3, 300);
                      if (!ok) {
                        toast({
                          title: 'Fullscreen blocked',
                          description: 'Please enable fullscreen using your browser controls.',
                        });
                      }
                    }}
                  >
                    <Maximize2 className="mr-2 h-4 w-4" /> Fullscreen
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Question {currentQuestion + 1} of {quiz.questions.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Question {currentQuestion + 1}</CardTitle>
              <CardDescription className="text-base text-foreground pt-2">{question.question}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {question.type === 'mcq' && question.options ? (
                <RadioGroup value={answers[currentQuestion]} onValueChange={handleAnswerChange}>
                  {question.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                      <RadioGroupItem value={String.fromCharCode(65 + idx)} id={`opt-${idx}`} />
                      <Label htmlFor={`opt-${idx}`} className="flex-1 cursor-pointer">
                        <span className="font-semibold mr-2">{String.fromCharCode(65 + idx)}.</span>{opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="answer">Your Answer</Label>
                  <Textarea
                    id="answer"
                    value={answers[currentQuestion]}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    rows={6}
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                  disabled={currentQuestion === 0}
                >
                  Previous
                </Button>

                {currentQuestion === quiz.questions.length - 1 ? (
                  <Button onClick={handleSubmitQuiz} disabled={submitting}>
                    {submitting ? <> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting... </> : 'Submit Quiz'}
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      setCurrentQuestion(Math.min(quiz.questions.length - 1, currentQuestion + 1))
                    }
                  >
                    Next
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader><CardTitle className="text-sm">Question Navigator</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-10 gap-2">
                {quiz.questions.map((_, idx) => (
                  <Button
                    key={idx}
                    variant={
                      currentQuestion === idx
                        ? 'default'
                        : answers[idx]
                        ? 'secondary'
                        : 'outline'
                    }
                    size="sm"
                    onClick={() => setCurrentQuestion(idx)}
                    className="w-full aspect-square"
                  >
                    {idx + 1}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // fallback not found
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle>Quiz Not Found</CardTitle>
          <CardDescription>The quiz link is invalid or has expired.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
