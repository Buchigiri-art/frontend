// src/pages/StudentQuizPage.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Clock, CheckCircle2, AlertCircle, Maximize2 } from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const MAX_WARNINGS = 3;
const LEAVE_BUDGET_MS = 10000; // 10 seconds total away budget
const SPLIT_DIM_THRESHOLD = 0.8;
const VIOLATION_COOLDOWN_MS = 3000; // for non-focus repeat violations
const POLL_INTERVAL_MS = 150; // stricter poll interval

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

  const [showInfoForm, setShowInfoForm] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentUSN, setStudentUSN] = useState('');
  const [studentBranch, setStudentBranch] = useState('');
  const [studentYear, setStudentYear] = useState('');
  const [studentSemester, setStudentSemester] = useState('');

  const [quizStarted, setQuizStarted] = useState(false);
  const [attemptId, setAttemptId] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const [warningCount, setWarningCount] = useState(0);
  const [isCheated, setIsCheated] = useState(false);

  // UI: remaining away time and whether we are currently "away"
  const [leaveTimeLeft, setLeaveTimeLeft] = useState<number>(LEAVE_BUDGET_MS);
  const [isAway, setIsAway] = useState(false);

  // Refs for stale closures & timing
  const localWarningsRef = useRef(0);
  const lastWarnAtRef = useRef(0);
  const lastViolationTimeRef = useRef(0);
  const tokenRef = useRef(token);
  const monitoringRef = useRef(false);
  const attemptIdRef = useRef('');
  const quizActiveRef = useRef(false);
  const quizSubmittedRef = useRef(false);

  // Whether we are currently in an "away" episode
  const isAwayRef = useRef(false);

  // Whether fullscreen has ever worked on this device
  const didEnterFullscreenRef = useRef(false);

  // Global away accounting (no setTimeout, wall-clock only)
  const usedLeaveMsRef = useRef(0); // total used across episodes
  const awayStartAtRef = useRef<number | null>(null); // Date.now when current episode started

  // Ensure only ONE warning per away episode
  const hasEpisodeWarningRef = useRef(false);

  attemptIdRef.current = attemptId;
  tokenRef.current = token;

  // Helper: how much away budget remains right now
  const getRemainingLeaveMs = () => {
    const baseUsed = usedLeaveMsRef.current;
    if (isAwayRef.current && awayStartAtRef.current !== null) {
      const now = Date.now();
      const extra = now - awayStartAtRef.current;
      return Math.max(0, LEAVE_BUDGET_MS - (baseUsed + extra));
    }
    return Math.max(0, LEAVE_BUDGET_MS - baseUsed);
  };

  // ------------------- Initial data load -------------------
  useEffect(() => {
    tokenRef.current = token;
    fetchQuizData();

    return () => {
      quizActiveRef.current = false;
      quizSubmittedRef.current = false;
      removeMonitoringListeners();
      resetAwayState();
      restoreBodyStyles();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ----------------- Monitoring enable/disable -----------------
  useEffect(() => {
    if (quizStarted && !quizSubmitted) {
      quizActiveRef.current = true;
      quizSubmittedRef.current = false;
      enableMonitoring();
      return () => {
        quizActiveRef.current = false;
        removeMonitoringListeners();
      };
    } else {
      quizActiveRef.current = false;
      quizSubmittedRef.current = quizSubmitted;
      removeMonitoringListeners();
    }
  }, [quizStarted, quizSubmitted]);

  // ------------- Quiz countdown (fixed, single interval) -----------------
  useEffect(() => {
    if (!quizStarted || quizSubmitted) return;

    const intervalId = setInterval(() => {
      if (!quizActiveRef.current || quizSubmittedRef.current) return;

      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time is up: normal submit (not cheated)
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizStarted, quizSubmitted]);

  // ------------- Fetch quiz and attempt data -----------------
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

      if (typeof data.warningCount === 'number') {
        localWarningsRef.current = data.warningCount;
        setWarningCount(data.warningCount);
      } else {
        localWarningsRef.current = 0;
        setWarningCount(0);
      }

      const info = data.studentInfo || {};
      setStudentName(info.name || '');
      setStudentUSN(info.usn || '');
      setStudentBranch(info.branch || '');
      setStudentYear(info.year || '');
      setStudentSemester(info.semester || '');

      // reset away state
      resetAwayState();

      if (data.hasStarted && data.attemptId) {
        setAttemptId(data.attemptId);
        setAnswers(new Array(data.quiz.questions.length).fill(''));
        setTimeLeft((data.quiz.duration || 30) * 60);
        setQuizStarted(true);
        applyBodyStyles();
        setShowInfoForm(false);
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

  // Reset away/timer state
  const resetAwayState = () => {
    usedLeaveMsRef.current = 0;
    awayStartAtRef.current = null;
    isAwayRef.current = false;
    hasEpisodeWarningRef.current = false;
    setIsAway(false);
    setLeaveTimeLeft(LEAVE_BUDGET_MS);
  };

  // ------------------------ Start quiz ------------------------
  const handleStartQuiz = async () => {
    if (
      !studentName.trim() ||
      !studentUSN.trim() ||
      !studentBranch ||
      !studentYear ||
      !studentSemester
    ) {
      toast({
        title: 'Missing Information',
        description: 'Your details are incomplete. Please contact your instructor.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/student-quiz/attempt/start`, {
        token: tokenRef.current,
        studentName,
        studentUSN,
        studentBranch,
        studentYear,
        studentSemester,
      });

      setAttemptId(res.data.attemptId);
      setAnswers(new Array(res.data.quiz.questions.length).fill(''));
      setTimeLeft((res.data.quiz.duration || 30) * 60);
      setQuiz(res.data.quiz);
      setShowInfoForm(false);

      // Reset warnings and away timers
      localWarningsRef.current = 0;
      setWarningCount(0);
      lastViolationTimeRef.current = 0;
      lastWarnAtRef.current = 0;
      resetAwayState();
      didEnterFullscreenRef.current = false;

      applyBodyStyles();

      const ok = await tryEnterFullscreen(3, 300);
      if (ok) {
        didEnterFullscreenRef.current = true;
      } else {
        didEnterFullscreenRef.current = false;
        toast({
          title: 'Fullscreen not available',
          description:
            'Your device or browser did not enter fullscreen. Monitoring will still work for app/tab changes and backgrounding.',
        });
      }

      setQuizStarted(true);

      toast({
        title: 'Quiz Started',
        description:
          'Monitoring is enabled. Any focus loss (tab/app change, going to background, split-screen, or exiting fullscreen after enabled) uses your global 10-second away budget and may give warnings. After 3 warnings or after the full 10 seconds away total, the quiz auto-submits as cheated.',
      });
    } catch (err: any) {
      console.error('Error starting quiz:', err);

      const status = err?.response?.status;
      const data = err?.response?.data;

      // 🔐 SPECIAL VPN / PROXY MESSAGE
      if (status === 403 && data?.vpnBlocked) {
        toast({
          title: 'VPN / Proxy Detected',
          description:
            data?.message ||
            'A VPN / proxy / Tor connection was detected. Please turn it off and reload this page to start the quiz.',
          variant: 'destructive',
        });
      } else {
        // generic error
        toast({
          title: 'Error',
          description: data?.message || 'Failed to start quiz',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // ------------------- Submit quiz --------------------
  const handleSubmitQuiz = async () => {
    if (submitting || quizSubmittedRef.current) return;

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
      resetAwayState();
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

  // ------------------ Auto-submit as cheated --------------------
  const handleAutoSubmitAsCheat = async (reason = 'violation:auto-submit') => {
    if (quizSubmittedRef.current) return;

    // Mark quiz as cheated / blocked on the UI
    quizActiveRef.current = false;
    quizSubmittedRef.current = true;
    setIsCheated(true);
    setQuizSubmitted(true);

    // 1) Flag the attempt with reason (so backend knows it's cheating)
    try {
      await axios.post(`${API_URL}/student-quiz/attempt/flag`, {
        token: tokenRef.current,
        reason,
      });
    } catch (err) {
      console.warn('Flagging failed during auto-submit:', err);
    }

    // 2) Submit whatever answers are filled right now
    try {
      await axios.post(`${API_URL}/student-quiz/attempt/submit`, {
        attemptId: attemptIdRef.current || attemptId,
        answers,
      });
    } catch (err) {
      console.warn('Auto-submit failed:', err);
    }

    removeMonitoringListeners();
    resetAwayState();
    restoreBodyStyles();

    toast({
      title: 'Quiz Blocked',
      description: 'Detected violations. Quiz auto-submitted as cheated.',
      variant: 'destructive',
    });
  };

  // ------------- Handle answer change --------------
  const handleAnswerChange = (value: string) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = value;
    setAnswers(newAnswers);
  };

  // ------------------ Try enter fullscreen -----------------
  const tryEnterFullscreen = async (retries = 3, delayMs = 300): Promise<boolean> => {
    const attemptFS = async (): Promise<boolean> => {
      try {
        if (document.fullscreenElement) return true;
        const el: any = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        return !!document.fullscreenElement;
      } catch {
        return false;
      }
    };

    for (let i = 0; i < retries; i++) {
      if (await attemptFS()) return true;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
  };

  // ---------------- Helper guards ----------------
  const guard = () => {
    if (!quizActiveRef.current || quizSubmittedRef.current) return false;
    return true;
  };

  const handleReturnToFocus = () => {
    if (!quizActiveRef.current || quizSubmittedRef.current) return;
    if (!isAwayRef.current) {
      setLeaveTimeLeft(getRemainingLeaveMs());
      return;
    }

    // Close current away episode and accumulate time
    if (awayStartAtRef.current !== null) {
      const now = Date.now();
      const extra = now - awayStartAtRef.current;
      usedLeaveMsRef.current = Math.min(LEAVE_BUDGET_MS, usedLeaveMsRef.current + extra);
    }

    awayStartAtRef.current = null;
    isAwayRef.current = false;
    hasEpisodeWarningRef.current = false;
    setIsAway(false);
    setLeaveTimeLeft(getRemainingLeaveMs());
  };

  // ---------------- Monitoring event management -----------------
  const enableMonitoring = () => {
    if (monitoringRef.current) return;
    monitoringRef.current = true;

    document.addEventListener('visibilitychange', onVisibilityChange, true);
    window.addEventListener('focus', onWindowFocus, true);
    window.addEventListener('blur', onWindowBlur, true); // NEW: treat blur as potential away
    document.addEventListener('fullscreenchange', onFullscreenChange, true);
    window.addEventListener('copy', onCopyAttempt, true);
    window.addEventListener('beforeunload', onBeforeUnload, true);

    if (!isMobile) {
      window.addEventListener('pagehide', onPageHide, true);
    }

    document.addEventListener('contextmenu', onContextMenu, true);
    window.addEventListener('keydown', onKeyDown, true);

    isAwayRef.current = false;
    hasEpisodeWarningRef.current = false;
    setIsAway(false);
    setLeaveTimeLeft(getRemainingLeaveMs());

    pollFocusVisibility();
    applyBodyStyles();
  };

  const removeMonitoringListeners = () => {
    if (!monitoringRef.current) return;
    monitoringRef.current = false;

    document.removeEventListener('visibilitychange', onVisibilityChange, true);
    window.removeEventListener('focus', onWindowFocus, true);
    window.removeEventListener('blur', onWindowBlur, true); // NEW
    document.removeEventListener('fullscreenchange', onFullscreenChange, true);
    window.removeEventListener('copy', onCopyAttempt, true);
    window.removeEventListener('beforeunload', onBeforeUnload, true);

    if (!isMobile) {
      window.removeEventListener('pagehide', onPageHide, true);
    }

    document.removeEventListener('contextmenu', onContextMenu, true);
    window.removeEventListener('keydown', onKeyDown, true);
  };

  const pollFocusVisibility = useCallback(() => {
    if (!monitoringRef.current) return;

    // If quiz not active, just reschedule check and bail
    if (!guard()) {
      requestAnimationFrame(() => setTimeout(pollFocusVisibility, POLL_INTERVAL_MS));
      return;
    }

    const fullscreenOk =
      !didEnterFullscreenRef.current || !!document.fullscreenElement;

    // Detect split-screen / resized window as "lost"
    let splitLost = false;
    try {
      const sw = window.screen.width || window.innerWidth;
      const sh = window.screen.height || window.innerHeight;
      if (sw && sh) {
        const wr = window.innerWidth / sw;
        const hr = window.innerHeight / sh;
        if (wr < SPLIT_DIM_THRESHOLD || hr < SPLIT_DIM_THRESHOLD) {
          splitLost = true;
        }
      }
    } catch {
      // ignore
    }

    const lost =
      document.visibilityState !== 'visible' ||
      !(document.hasFocus && document.hasFocus()) ||
      !fullscreenOk ||
      splitLost;

    if (lost) {
      handleFocusLostViolation('poll:focus-visibility', () => {
        const fullscreenOkInner =
          !didEnterFullscreenRef.current || !!document.fullscreenElement;

        let splitLostInner = false;
        try {
          const sw2 = window.screen.width || window.innerWidth;
          const sh2 = window.screen.height || window.innerHeight;
          if (sw2 && sh2) {
            const wr2 = window.innerWidth / sw2;
            const hr2 = window.innerHeight / sh2;
            if (wr2 < SPLIT_DIM_THRESHOLD || hr2 < SPLIT_DIM_THRESHOLD) {
              splitLostInner = true;
            }
          }
        } catch {
          // ignore
        }

        return (
          document.visibilityState !== 'visible' ||
          !(document.hasFocus && document.hasFocus()) ||
          !fullscreenOkInner ||
          splitLostInner
        );
      });
    } else {
      handleReturnToFocus();
    }

    // While away, update remaining time and enforce timeout
    if (isAwayRef.current) {
      const remaining = getRemainingLeaveMs();
      setLeaveTimeLeft(remaining);
      if (remaining <= 0) {
        handleAutoSubmitAsCheat('away-timeout');
      }
    }

    requestAnimationFrame(() => setTimeout(pollFocusVisibility, POLL_INTERVAL_MS));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------- Warnings management ----------------
  const sendFlag = async (reason: string) => {
    const now = performance.now();
    if (now - (lastWarnAtRef.current || 0) < 500) {
      // small debounce to avoid duplicate warnings from weird edge cases
      return;
    }
    lastWarnAtRef.current = now;

    localWarningsRef.current++;
    setWarningCount(localWarningsRef.current);

    const remainingWarnings = Math.max(0, MAX_WARNINGS - localWarningsRef.current);
    const remainingMs = getRemainingLeaveMs();

    toast({
      title: `Warning ${localWarningsRef.current} / ${MAX_WARNINGS}`,
      description:
        remainingWarnings > 0
          ? `Violation detected (${reason}). ${remainingWarnings} warning(s) remaining before auto-submit. Away time left: ${Math.ceil(
              remainingMs / 1000,
            )} second${remainingMs > 1000 ? 's' : ''} (global 10-second limit).`
          : `Violation detected (${reason}). You have reached the maximum warnings. The next violation will auto-submit the quiz.`,
      variant: remainingWarnings > 0 ? 'default' : 'destructive',
    });

    try {
      await axios.post(`${API_URL}/student-quiz/attempt/flag`, {
        token: tokenRef.current,
        reason,
      });
    } catch (err) {
      console.warn('Flag send failed:', err);
    }
  };

  // ------------------ Unified focus-loss handler ------------------
  const handleFocusLostViolation = (
    reasonBase: string,
    stillAwayCheck: () => boolean,
  ) => {
    if (!guard()) return;

    // Re-check: if user already came back, do nothing
    if (!stillAwayCheck()) {
      handleReturnToFocus();
      return;
    }

    // Check global away-time budget (already fully used)
    const currentRemaining = getRemainingLeaveMs();
    if (currentRemaining <= 0) {
      // No budget left at all: any further focus loss = immediate auto-submit
      handleAutoSubmitAsCheat(`${reasonBase}:no-budget-left`);
      return;
    }

    // Already in an away episode -> just update time, no new warning
    if (isAwayRef.current) {
      const remaining = getRemainingLeaveMs();
      setLeaveTimeLeft(remaining);
      if (remaining <= 0) {
        handleAutoSubmitAsCheat(`${reasonBase}:timeout`);
      }
      return;
    }

    // New away episode
    // If already at max warnings, this extra violation = auto-submit
    if (localWarningsRef.current >= MAX_WARNINGS) {
      handleAutoSubmitAsCheat(`${reasonBase}:max-warnings-exceeded`);
      return;
    }

    // Start away episode
    isAwayRef.current = true;
    setIsAway(true);
    awayStartAtRef.current = Date.now();
    setLeaveTimeLeft(currentRemaining);
    hasEpisodeWarningRef.current = false;

    // Single warning per away episode (1st/2nd/3rd violations)
    if (!hasEpisodeWarningRef.current && localWarningsRef.current < MAX_WARNINGS) {
      sendFlag(reasonBase);
      hasEpisodeWarningRef.current = true;
    }
  };

  // ------------- Event listeners (auxiliary) ---------------
  const onVisibilityChange = () => {
    if (!guard()) return;

    if (document.visibilityState === 'visible') {
      // Coming back -> ensure we close the away episode properly
      handleReturnToFocus();
    }
    // We do NOT call handleFocusLostViolation here.
    // The polling loop is the single source of "lost" truth.
  };

  const onWindowFocus = () => {
    if (!guard()) return;
    handleReturnToFocus();
  };

  // NEW: strict blur handler
  const onWindowBlur = () => {
    if (!guard()) return;

    // Treat ANY blur as a potential away episode; confirm using same conditions as polling
    handleFocusLostViolation('event:blur', () => {
      const fullscreenOk =
        !didEnterFullscreenRef.current || !!document.fullscreenElement;

      let splitLost = false;
      try {
        const sw = window.screen.width || window.innerWidth;
        const sh = window.screen.height || window.innerHeight;
        if (sw && sh) {
          const wr = window.innerWidth / sw;
          const hr = window.innerHeight / sh;
          if (wr < SPLIT_DIM_THRESHOLD || hr < SPLIT_DIM_THRESHOLD) {
            splitLost = true;
          }
        }
      } catch {
        // ignore
      }

      return (
        document.visibilityState !== 'visible' ||
        !(document.hasFocus && document.hasFocus()) ||
        !fullscreenOk ||
        splitLost
      );
    });
  };

  const onFullscreenChange = () => {
    if (!guard()) return;

    const isFs = !!document.fullscreenElement;

    if (isFs) {
      didEnterFullscreenRef.current = true;
      handleReturnToFocus();
    }
    // When fullscreen is exited, we do NOT directly call handleFocusLostViolation.
    // Polling will detect the lack of fullscreen and treat it as "lost" if needed.
  };

  const onPageHide = (_e: Event) => {
    if (!guard()) return;
    // Page hiding is considered "away" – poll loop will see visibility hidden.
  };

  const onCopyAttempt = (e: ClipboardEvent) => {
    if (!guard()) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastViolationTimeRef.current < VIOLATION_COOLDOWN_MS) return;
    lastViolationTimeRef.current = now;

    if (localWarningsRef.current < MAX_WARNINGS) {
      // still under max → warning only
      sendFlag('clipboard:copy');
    } else {
      // already at max → this extra violation auto-submits
      handleAutoSubmitAsCheat('clipboard:copy:max-warnings-exceeded');
    }
  };

  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!guard()) return;
    // Trying to leave the page entirely → treat as cheating immediately
    sendFlag('attempt:beforeunload');
    handleAutoSubmitAsCheat('attempt:beforeunload');
    e.preventDefault();
    e.returnValue = '';
  };

  const onContextMenu = (e: Event) => {
    if (!guard()) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastViolationTimeRef.current < VIOLATION_COOLDOWN_MS) return;
    lastViolationTimeRef.current = now;

    if (localWarningsRef.current < MAX_WARNINGS) {
      sendFlag('contextmenu:block');
    } else {
      handleAutoSubmitAsCheat('contextmenu:block:max-warnings-exceeded');
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!guard()) return;

    const key = e.key?.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    let reason: string | null = null;

    if (key === 'f12') reason = 'key:f12';
    else if (ctrl && shift && ['i', 'c', 'j'].includes(key)) reason = `key:ctrl-shift-${key}`;
    else if (ctrl && key === 'u') reason = 'key:ctrl-u';
    else if (ctrl && key === 's') reason = 'key:ctrl-s';

    if (reason) {
      e.preventDefault();
      const now = performance.now();
      if (now - lastViolationTimeRef.current < VIOLATION_COOLDOWN_MS) return;
      lastViolationTimeRef.current = now;

      if (localWarningsRef.current < MAX_WARNINGS) {
        sendFlag(reason);
      } else {
        handleAutoSubmitAsCheat(`${reason}:max-warnings-exceeded`);
      }
    }
  };

  // ---------------- Body styles ----------------
  const applyBodyStyles = () => {
    try {
      const body = document.body;
      if (!body.dataset.prevUserSelect) body.dataset.prevUserSelect = body.style.userSelect || '';
      if (!body.dataset.prevWebkitTouchCallout)
        body.dataset.prevWebkitTouchCallout = (body.style as any).webkitTouchCallout || '';
      if (!body.dataset.prevTouchAction) body.dataset.prevTouchAction = body.style.touchAction || '';
      // NOTE: we no longer store/override overflow here

      body.style.userSelect = 'none';
      (body.style as any).webkitTouchCallout = 'none';
      body.style.touchAction = 'manipulation';
      // body.style.overflow is left alone so scrolling still works
    } catch {
      // ignore
    }
  };

  const restoreBodyStyles = () => {
    try {
      const body = document.body;
      if (body.dataset.prevUserSelect !== undefined)
        body.style.userSelect = body.dataset.prevUserSelect;
      if (body.dataset.prevWebkitTouchCallout !== undefined)
        (body.style as any).webkitTouchCallout = body.dataset.prevWebkitTouchCallout;
      if (body.dataset.prevTouchAction !== undefined)
        body.style.touchAction = body.dataset.prevTouchAction;

      delete body.dataset.prevUserSelect;
      delete body.dataset.prevWebkitTouchCallout;
      delete body.dataset.prevTouchAction;
    } catch {
      // ignore
    }
  };

  // ------------- Format time for display ---------------
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ------------------ UI ----------------------
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
                ? 'Your quiz was blocked due to repeated or prolonged violations. Contact the instructor if this is in error.'
                : 'Thank you — your quiz has been submitted.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

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
              <Input id="name" value={studentName} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usn">USN *</Label>
              <Input id="usn" value={studentUSN} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch">Branch *</Label>
              <Input id="branch" value={studentBranch} disabled className="bg-muted" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="year">Year *</Label>
                <Input id="year" value={studentYear} disabled className="bg-muted" />
              </div>
              <div>
                <Label htmlFor="semester">Semester *</Label>
                <Input id="semester" value={studentSemester} disabled className="bg-muted" />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Your details are provided by your instructor and cannot be changed here.
                Monitoring is enabled. Any time this quiz loses focus or goes behind another
                app/tab (including split-screen or going to background), your global{' '}
                <span className="font-semibold">10-second away budget</span> counts down.
                After 3 warnings or when that 10 seconds is fully used, the quiz is
                auto-submitted as cheated.
              </p>
            </div>
            <Button onClick={handleStartQuiz} className="w-full" disabled={loading}>
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

  if (quizStarted && quiz?.questions) {
    const question = quiz.questions[currentQuestion];
    const progress = ((currentQuestion + 1) / quiz.questions.length) * 100;

    const showFullscreenButton = true; // always allow trying fullscreen again

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
                <p className="text-xs mt-1">
                  Away budget left:{' '}
                  <span className={leaveTimeLeft <= 3000 ? 'text-destructive font-semibold' : ''}>
                    {Math.ceil(leaveTimeLeft / 1000)} second
                    {leaveTimeLeft > 1000 ? 's' : ''} (global 10-second limit)
                  </span>
                  {isAway && (
                    <span className="ml-1 text-xs text-destructive">
                      — currently away / focus lost
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Clock
                  className={`h-5 w-5 ${
                    timeLeft < 300 ? 'text-destructive' : 'text-primary'
                  }`}
                />
                <span className={timeLeft < 300 ? 'text-destructive' : 'text-foreground'}>
                  {formatTime(timeLeft)}
                </span>
                {showFullscreenButton && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      const ok = await tryEnterFullscreen(3, 300);
                      if (ok) {
                        didEnterFullscreenRef.current = true;
                      } else {
                        didEnterFullscreenRef.current = false;
                        toast({
                          title: 'Fullscreen not available',
                          description:
                            'Your device or browser did not enter fullscreen. Monitoring will still work for app/tab changes and backgrounding.',
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
              <CardTitle className="text-lg">Question {currentQuestion + 1}</CardTitle>
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
                      <Label htmlFor={`opt-${idx}`} className="flex-1 cursor-pointer">
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
                  onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
                  disabled={currentQuestion === 0}
                >
                  Previous
                </Button>
                {currentQuestion === quiz.questions.length - 1 ? (
                  <Button onClick={handleSubmitQuiz} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                      </>
                    ) : (
                      'Submit Quiz'
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      setCurrentQuestion(
                        Math.min(quiz.questions.length - 1, currentQuestion + 1),
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

  // ---------------- Quiz not found fallback ----------------
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
