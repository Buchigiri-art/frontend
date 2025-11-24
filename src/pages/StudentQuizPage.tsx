// src/pages/StudentQuizPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/use-toast';
import {
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Maximize2,
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const MAX_WARNINGS = 3; // 3 warnings, then auto-submit as cheat
const LEAVE_TIMEOUT_MS = 10000; // 10 seconds to come back before auto-submit

// Detect mobile – used to adjust behavior
const isMobile =
  typeof navigator !== 'undefined' &&
  /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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

  // Student info form (locked details)
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
  const tokenRef = useRef<string | undefined>(token);
  const monitoringRef = useRef<boolean>(false);
  const leaveTimeoutRef = useRef<number | null>(null); // for 10s leave timer

  // Refs so event handlers see live state
  const quizActiveRef = useRef<boolean>(false);
  const quizSubmittedRef = useRef<boolean>(false);

  // AttemptId ref for async auto-submit
  const attemptIdRef = useRef<string>('');
  attemptIdRef.current = attemptId;

  // ----------------- INITIAL LOAD -----------------
  useEffect(() => {
    tokenRef.current = token;
    fetchQuizData();
    return () => {
      // global cleanup if component unmounts
      quizActiveRef.current = false;
      quizSubmittedRef.current = false;
      removeMonitoringListeners();
      clearLeaveTimer();
      restoreBodyStyles();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Enable / disable monitoring whenever quizStarted / quizSubmitted change
  useEffect(() => {
    if (quizStarted && !quizSubmitted) {
      quizActiveRef.current = true;
      quizSubmittedRef.current = false;
      enableMonitoring();
      return () => {
        quizActiveRef.current = false;
        removeMonitoringListeners();
        clearLeaveTimer();
      };
    } else {
      quizActiveRef.current = false;
      quizSubmittedRef.current = quizSubmitted;
      removeMonitoringListeners();
      clearLeaveTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizStarted, quizSubmitted]);

  // Timer countdown
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

      // Prefill ALL student info from backend (and lock those fields in UI)
      const info = data.studentInfo || {};
      setStudentName(info.name || '');
      setStudentUSN(info.usn || '');
      setStudentBranch(info.branch || '');
      setStudentYear(info.year || '');
      setStudentSemester(info.semester || '');

      if (data.hasStarted && data.attemptId) {
        setAttemptId(data.attemptId);
        setAnswers(new Array(data.quiz.questions.length).fill(''));
        setTimeLeft((data.quiz.duration || 30) * 60);

        // Already started quiz, go directly into quiz
        setQuizStarted(true); // triggers monitoring via useEffect
        applyBodyStyles();
        setShowInfoForm(false);
      } else {
        // Not started yet → show info dialog with LOCKED details
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

  // ----------------- START / SUBMIT -----------------
  const handleStartQuiz = async () => {
    // Still keep basic validation in case backend missed something
    if (
      !studentName.trim() ||
      !studentUSN.trim() ||
      !studentBranch ||
      !studentYear ||
      !studentSemester
    ) {
      toast({
        title: 'Missing Information',
        description: 'Your details are incomplete. Please contact your teacher.',
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
      setShowInfoForm(false);

      applyBodyStyles();

      // Try fullscreen (may be blocked)
      await tryEnterFullscreen(3, 300);

      // Now mark quiz started -> monitoring useEffect will attach listeners
      setQuizStarted(true);

      toast({
        title: 'Quiz Started',
        description:
          'Quiz is monitored. Tab-switch/minimize/fullscreen exits will give warnings (max 3).',
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

  const handleSubmitQuiz = async () => {
    if (submitting || quizSubmitted) return;

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/student-quiz/attempt/submit`, {
        attemptId: attemptIdRef.current || attemptId,
        answers,
      });

      quizActiveRef.current = false;
      quizSubmittedRef.current = true;

      setQuizSubmitted(true);
      removeMonitoringListeners();
      clearLeaveTimer();
      restoreBodyStyles();

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

  const handleAutoSubmitAsCheat = async (
    reason = 'violation:auto-submit',
  ) => {
    if (quizSubmittedRef.current) return;

    quizActiveRef.current = false;
    quizSubmittedRef.current = true;
    setIsCheated(true);
    setQuizSubmitted(true);

    try {
      await axios.post(`${API_URL}/student-quiz/attempt/flag`, { token, reason });
    } catch (err) {
      console.warn('Flagging failed during auto-submit:', err);
    }

    try {
      await axios.post(`${API_URL}/student-quiz/attempt/submit`, {
        attemptId: attemptIdRef.current || attemptId,
        answers,
      });
    } catch (err) {
      console.warn('Auto-submit failed:', err);
    }

    removeMonitoringListeners();
    clearLeaveTimer();
    restoreBodyStyles();

    toast({
      title: 'Quiz Blocked',
      description:
        'Repeated or severe violations detected. The quiz has been auto-submitted as cheated.',
      variant: 'destructive',
    });
  };

  const handleAnswerChange = (value: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = value;
    setAnswers(newAnswers);
  };

  // ----------------- FULLSCREEN HELPERS -----------------
  const tryEnterFullscreen = async (
    retries = 3,
    delayMs = 300,
  ): Promise<boolean> => {
    const attemptFS = async (): Promise<boolean> => {
      try {
        if (document.fullscreenElement) return true;
        const el: any = document.documentElement;
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        }
        return !!document.fullscreenElement;
      } catch {
        return false;
      }
    };

    for (let i = 0; i < retries; i++) {
      const ok = await attemptFS();
      if (ok) return true;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
  };

  // ----------------- LEAVE TIMER HELPERS -----------------
  const startLeaveTimer = (reason: string) => {
    if (leaveTimeoutRef.current != null || quizSubmittedRef.current) return;
    leaveTimeoutRef.current = window.setTimeout(() => {
      leaveTimeoutRef.current = null;
      if (document.visibilityState !== 'visible') {
        handleAutoSubmitAsCheat(`${reason}:timeout`);
      }
    }, LEAVE_TIMEOUT_MS);
  };

  const clearLeaveTimer = () => {
    if (leaveTimeoutRef.current != null) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  // ----------------- MONITORING -----------------
  const enableMonitoring = () => {
    if (monitoringRef.current) return;
    monitoringRef.current = true;

    document.addEventListener('visibilitychange', onVisibilityChange, true);
    window.addEventListener('focus', onWindowFocus, true);
    document.addEventListener('fullscreenchange', onFullscreenChange, true);
    window.addEventListener('copy', onCopyAttempt, true);
    window.addEventListener('beforeunload', onBeforeUnload, true);

    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('keydown', onKeyDown, true);

    applyBodyStyles();
  };

  const removeMonitoringListeners = () => {
    if (!monitoringRef.current) return;
    monitoringRef.current = false;

    document.removeEventListener('visibilitychange', onVisibilityChange, true);
    window.removeEventListener('focus', onWindowFocus, true);
    document.removeEventListener('fullscreenchange', onFullscreenChange, true);
    window.removeEventListener('copy', onCopyAttempt, true);
    window.removeEventListener('beforeunload', onBeforeUnload, true);

    document.removeEventListener('contextmenu', onContextMenu, true);
    window.removeEventListener('keydown', onKeyDown, true);
  };

  // ----------------- WARNINGS / FLAGS -----------------
  const sendFlag = async (reason: string) => {
    const now = Date.now();
    if (now - (lastWarnAtRef.current || 0) < 500) return;
    lastWarnAtRef.current = now;

    localWarningsRef.current += 1;
    const count = localWarningsRef.current;
    setWarningCount(count);

    const remaining = Math.max(0, MAX_WARNINGS - count);
    toast({
      title: `Warning ${count} / ${MAX_WARNINGS}`,
      description:
        remaining > 0
          ? `Violation detected (${reason}). ${remaining} warning(s) remaining before auto-submit.`
          : `Violation detected (${reason}). Limit reached; quiz will be auto-submitted.`,
      variant: remaining > 0 ? 'default' : 'destructive',
    });

    try {
      await axios.post(`${API_URL}/student-quiz/attempt/flag`, { token, reason });
    } catch (err) {
      console.warn('Flag send failed:', err);
    }
  };

  // ----------------- EVENT HANDLERS -----------------
  const guard = () => {
    if (!quizActiveRef.current || quizSubmittedRef.current) return false;
    return true;
  };

  const onVisibilityChange = () => {
    if (!guard()) return;

    if (document.visibilityState === 'visible') {
      clearLeaveTimer();
      return;
    }

    const firedAt = Date.now();
    setTimeout(() => {
      if (!guard()) return;
      if (document.visibilityState === 'visible') return;
      if (Date.now() - firedAt < 250) return;

      if (isMobile) {
        sendFlag('visibility:hidden:mobile');
        handleAutoSubmitAsCheat('visibility:hidden:mobile-immediate');
        return;
      }

      sendFlag('visibility:hidden');
      const count = localWarningsRef.current;
      if (count >= MAX_WARNINGS) {
        handleAutoSubmitAsCheat('visibility:hidden:max-warnings');
      } else {
        startLeaveTimer('visibility:hidden');
      }
    }, 300);
  };

  const onWindowFocus = () => {
    if (!guard()) return;
    clearLeaveTimer();
  };

  const onFullscreenChange = () => {
    if (!guard()) return;

    const isFs = !!document.fullscreenElement;
    if (!isFs) {
      sendFlag('fullscreen:exited');
      const count = localWarningsRef.current;
      if (count >= MAX_WARNINGS) {
        handleAutoSubmitAsCheat('fullscreen:exited:max-warnings');
      } else {
        startLeaveTimer('fullscreen:exited');
      }
    } else {
      clearLeaveTimer();
    }
  };

  const onCopyAttempt = (e: ClipboardEvent) => {
    if (!guard()) return;
    e.preventDefault();
    sendFlag('clipboard:copy');
    const count = localWarningsRef.current;
    if (count >= MAX_WARNINGS) {
      handleAutoSubmitAsCheat('clipboard:copy:max-warnings');
    }
  };

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!guard()) return;
    sendFlag('attempt:beforeunload');
    handleAutoSubmitAsCheat('attempt:beforeunload');
    e.preventDefault();
    e.returnValue = '';
  };

  const onContextMenu = (e: Event) => {
    if (!guard()) return;
    e.preventDefault();
    sendFlag('contextmenu:block');
    const count = localWarningsRef.current;
    if (count >= MAX_WARNINGS) {
      handleAutoSubmitAsCheat('contextmenu:block:max-warnings');
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!guard()) return;

    const key = e.key?.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    let reason: string | null = null;

    if (key === 'f12') {
      reason = 'key:f12';
    } else if (ctrl && shift && ['i', 'c', 'j'].includes(key)) {
      reason = `key:ctrl-shift-${key}`;
    } else if (ctrl && key === 'u') {
      reason = 'key:ctrl-u';
    } else if (ctrl && key === 's') {
      reason = 'key:ctrl-s';
    }

    if (reason) {
      e.preventDefault();
      sendFlag(reason);
      const count = localWarningsRef.current;
      if (count >= MAX_WARNINGS) {
        handleAutoSubmitAsCheat(`${reason}:max-warnings`);
      }
    }
  };

  // ----------------- BODY STYLES -----------------
  const applyBodyStyles = () => {
    try {
      const body = document.body;

      if (!body.dataset.prevUserSelect)
        body.dataset.prevUserSelect = body.style.userSelect || '';
      if (!body.dataset.prevWebkitTouchCallout)
        (body.dataset as any).prevWebkitTouchCallout =
          (body.style as any).webkitTouchCallout || '';
      if (!body.dataset.prevTouchAction)
        body.dataset.prevTouchAction = body.style.touchAction || '';
      if (!body.dataset.prevOverflow)
        body.dataset.prevOverflow = body.style.overflow || '';

      body.style.userSelect = 'none';
      (body.style as any).webkitTouchCallout = 'none';
      body.style.touchAction = 'manipulation';
      body.style.overflow = 'hidden';
    } catch {
      // ignore
    }
  };

  const restoreBodyStyles = () => {
    try {
      const body = document.body;
      if (body.dataset.prevUserSelect !== undefined)
        body.style.userSelect = body.dataset.prevUserSelect;
      if ((body.dataset as any).prevWebkitTouchCallout !== undefined) {
        (body.style as any).webkitTouchCallout = (body.dataset as any)
          .prevWebkitTouchCallout;
      }
      if (body.dataset.prevTouchAction !== undefined)
        body.style.touchAction = body.dataset.prevTouchAction;
      if (body.dataset.prevOverflow !== undefined)
        body.style.overflow = body.dataset.prevOverflow;

      delete body.dataset.prevUserSelect;
      delete (body.dataset as any).prevWebkitTouchCallout;
      delete body.dataset.prevTouchAction;
      delete body.dataset.prevOverflow;
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

  // ----------------- UI -----------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                ? 'Your quiz was blocked due to repeated violations. Contact the instructor if this is in error.'
                : 'Thank you — your quiz has been submitted.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Info form before starting
  if (showInfoForm && quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>{quiz.title}</CardTitle>
            <CardDescription>
              {quiz.description || 'Confirm your details to start the quiz'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Full name"
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="usn">USN *</Label>
              <Input
                id="usn"
                value={studentUSN}
                onChange={(e) => setStudentUSN(e.target.value.toUpperCase())}
                placeholder="USN"
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch *</Label>
              <Select
                value={studentBranch}
                onValueChange={setStudentBranch}
                disabled
              >
                <SelectTrigger className="bg-muted">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
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
                <Select
                  value={studentYear}
                  onValueChange={setStudentYear}
                  disabled
                >
                  <SelectTrigger className="bg-muted">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
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
                <Select
                  value={studentSemester}
                  onValueChange={setStudentSemester}
                  disabled
                >
                  <SelectTrigger className="bg-muted">
                    <SelectValue placeholder="Sem" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <SelectItem key={s} value={s.toString()}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Your details are provided by your instructor and cannot be changed
                here.
                <br />
                Monitoring is enabled. If you minimize, switch tabs, or exit
                fullscreen, you get a warning. After 3 warnings, the quiz is
                blocked and auto-submitted. On mobile, leaving the quiz screen can
                immediately auto-submit.
              </p>
            </div>

            <Button
              onClick={handleStartQuiz}
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Starting...
                </>
              ) : (
                'Start Quiz'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active quiz UI
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
                <p className="text-sm text-muted-foreground">
                  {studentName} ({studentUSN})
                </p>
                <p className="text-xs text-muted-foreground">
                  Warnings: {warningCount} / {MAX_WARNINGS}
                </p>
              </div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Clock
                  className={`h-5 w-5 ${
                    timeLeft < 300 ? 'text-destructive' : 'text-primary'
                  }`}
                />
                <span
                  className={
                    timeLeft < 300 ? 'text-destructive' : 'text-foreground'
                  }
                >
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
                          description:
                            'Please allow fullscreen via the browser UI or settings.',
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
                <span>
                  Question {currentQuestion + 1} of {quiz.questions.length}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Question {currentQuestion + 1}
              </CardTitle>
              <CardDescription className="text-base text-foreground pt-2">
                {question.question}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {question.type === 'mcq' && question.options ? (
                <RadioGroup
                  value={answers[currentQuestion]}
                  onValueChange={handleAnswerChange}
                >
                  {question.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent"
                    >
                      <RadioGroupItem
                        value={String.fromCharCode(65 + idx)}
                        id={`opt-${idx}`}
                      />
                      <Label
                        htmlFor={`opt-${idx}`}
                        className="flex-1 cursor-pointer"
                      >
                        <span className="font-semibold mr-2">
                          {String.fromCharCode(65 + idx)}.
                        </span>
                        {opt}
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
                  onClick={() =>
                    setCurrentQuestion(Math.max(0, currentQuestion - 1))
                  }
                  disabled={currentQuestion === 0}
                >
                  Previous
                </Button>

                {currentQuestion === quiz.questions.length - 1 ? (
                  <Button onClick={handleSubmitQuiz} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />{' '}
                        Submitting...
                      </>
                    ) : (
                      'Submit Quiz'
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      setCurrentQuestion(
                        Math.min(
                          quiz.questions.length - 1,
                          currentQuestion + 1,
                        ),
                      )
                    }
                  >
                    Next
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">Question Navigator</CardTitle>
            </CardHeader>
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

  // Fallback not found
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle>Quiz Not Found</CardTitle>
          <CardDescription>
            The quiz link is invalid or has expired.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
