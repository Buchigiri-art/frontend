// src/pages/QuizResultsPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import {
  Download,
  ArrowLeft,
  Loader2,
  FileSpreadsheet,
  Users,
  Award,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { quizAPI } from '@/services/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleUI,
  DialogDescription,
} from '@/components/ui/dialog';

interface QuizAttempt {
  _id: string;
  studentName: string;
  studentUSN: string;
  studentEmail: string;
  studentBranch: string;
  studentYear: string;
  studentSemester: string;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  status: string;
  submittedAt: string;
}

interface AttemptQuestion {
  _id?: string;
  questionText: string;
  type: 'mcq' | 'short-answer';
  options: string[];
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  marks: number;
  explanation?: string;
}

interface AttemptDetail {
  _id: string;
  quizId: string;
  teacherId: string;
  studentName: string;
  studentUSN: string;
  studentEmail: string;
  studentBranch: string;
  studentYear: string;
  studentSemester: string;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  status: string;
  submittedAt: string;
  startedAt?: string;
  gradedAt?: string;
  questions: AttemptQuestion[];
}

// A -> 0, B -> 1 etc
const optionLabel = (index: number) => String.fromCharCode(65 + index);

// normalize strings for comparison
const normalize = (v?: string) => (v ?? '').trim().toLowerCase();

// extract numeric part from USN for ordering like 001, 002, etc
const extractUsnNumber = (usn?: string) => {
  if (!usn) return Number.MAX_SAFE_INTEGER;
  const matches = usn.match(/(\d+)/g);
  if (!matches || matches.length === 0) return Number.MAX_SAFE_INTEGER;
  const last = matches[matches.length - 1];
  const num = parseInt(last, 10);
  return Number.isNaN(num) ? Number.MAX_SAFE_INTEGER : num;
};

// simple client-side pagination size
const PAGE_SIZE = 25;

type SortKey = 'usn' | 'name' | 'percentage';
type ViewMode = 'results' | 'leaderboard';

export default function QuizResultsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttempt | null>(null);
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetail | null>(null);

  const [page, setPage] = useState(1);

  // NEW: search & sort
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('usn');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // NEW: view mode & leaderboard control
  const [viewMode, setViewMode] = useState<ViewMode>('results');
  const [leaderboardCount, setLeaderboardCount] = useState<number>(5);

  // track initial load to avoid resetting page every auto-refresh
  const isInitialLoadRef = useRef(true);

  const calculateStats = () => {
    if (attempts.length === 0) return null;

    const avgRaw =
      attempts.reduce((sum, a) => sum + (a.percentage || 0), 0) /
      attempts.length;
    const avgPercentage = Number.isFinite(avgRaw) ? avgRaw : 0;
    const passCount = attempts.filter((a) => (a.percentage || 0) >= 40).length;

    const totalMarksArr = attempts
      .map((a) => a.totalMarks)
      .filter((v) => typeof v === 'number' && Number.isFinite(v));

    const highestMarks = totalMarksArr.length
      ? Math.max(...totalMarksArr)
      : 0;
    const lowestMarks = totalMarksArr.length
      ? Math.min(...totalMarksArr)
      : 0;

    const percArr = attempts
      .map((a) => a.percentage || 0)
      .filter((v) => Number.isFinite(v));

    const highestPercentage = percArr.length ? Math.max(...percArr) : 0;
    const lowestPercentage = percArr.length ? Math.min(...percArr) : 0;

    return {
      avgPercentage: avgPercentage.toFixed(2),
      passRate: ((passCount / attempts.length) * 100).toFixed(1),
      highestMarks,
      lowestMarks,
      highestPercentage: highestPercentage.toFixed(1),
      lowestPercentage: lowestPercentage.toFixed(1),
    };
  };

  const stats = calculateStats();

  const fetchResults = useCallback(
    async () => {
      if (!quizId) {
        setLoading(false);
        toast({
          title: 'Error',
          description: 'Missing quiz id in URL',
          variant: 'destructive',
        });
        return;
      }

      try {
        const data = await quizAPI.getResults(quizId);
        if (!data || !data.quiz) {
          throw new Error('Invalid response from server');
        }

        setQuizTitle(data.quiz.title || 'Quiz');
        const newAttempts: QuizAttempt[] = Array.isArray(data.attempts)
          ? data.attempts
          : [];

        setAttempts(newAttempts);

        setPage((prevPage) => {
          const newTotalPages = Math.max(
            1,
            Math.ceil(newAttempts.length / PAGE_SIZE)
          );

          // On very first successful load, go to page 1
          if (isInitialLoadRef.current) {
            return 1;
          }

          // On subsequent auto-refreshes, keep current page if possible
          return Math.min(prevPage, newTotalPages);
        });

        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
        }
      } catch (error: any) {
        console.error('Error fetching results:', error);
        toast({
          title: 'Error',
          description: 'Failed to load quiz results',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [quizId]
  );

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    if (!autoRefresh || !quizId) return;
    const interval = setInterval(() => {
      fetchResults();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchResults, quizId]);

  const handleDownloadExcel = async (detailed: boolean = false) => {
    if (!quizId) return;
    setDownloading(true);
    try {
      const blob = await quizAPI.downloadResults(quizId, detailed);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${(quizTitle || 'quiz')
          .toLowerCase()
          .replace(/[^a-z0-9]/gi, '_')}_results${
          detailed ? '_detailed' : ''
        }.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Excel file downloaded successfully',
      });
    } catch (error: any) {
      console.error('Error downloading Excel:', error);
      toast({
        title: 'Error',
        description: 'Failed to download Excel file',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const openAttemptDetail = async (attempt: QuizAttempt) => {
    if (!quizId) return;
    setSelectedAttempt(attempt);
    setDetailOpen(true);
    setDetailLoading(true);
    setAttemptDetail(null);

    try {
      const data = await quizAPI.getAttemptDetail(quizId, attempt._id);
      const detail: AttemptDetail = data.attempt;
      setAttemptDetail(detail);
    } catch (err: any) {
      console.error('Error fetching attempt detail:', err);
      toast({
        title: 'Error',
        description: 'Failed to load student answers',
        variant: 'destructive',
      });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // ---------- Derived data: sorting, searching, pagination ----------

  const matchesSearch = (attempt: QuizAttempt, term: string) => {
    const t = normalize(term);
    if (!t) return true;
    return [
      attempt.studentName,
      attempt.studentUSN,
      attempt.studentEmail,
      attempt.studentBranch,
      attempt.studentYear,
      attempt.studentSemester,
    ]
      .map((v) => normalize(String(v)))
      .some((v) => v.includes(t));
  };

  const sortedAttempts = [...attempts].sort((a, b) => {
    if (sortKey === 'percentage') {
      const av = a.percentage || 0;
      const bv = b.percentage || 0;
      return sortOrder === 'asc' ? av - bv : bv - av;
    }

    if (sortKey === 'name') {
      const av = a.studentName || '';
      const bv = b.studentName || '';
      return sortOrder === 'asc'
        ? av.localeCompare(bv)
        : bv.localeCompare(av);
    }

    // default: USN numeric sort (001, 002, etc)
    const av = extractUsnNumber(a.studentUSN);
    const bv = extractUsnNumber(b.studentUSN);
    if (av !== bv) {
      return sortOrder === 'asc' ? av - bv : bv - av;
    }
    const ausn = a.studentUSN || '';
    const busn = b.studentUSN || '';
    return sortOrder === 'asc'
      ? ausn.localeCompare(busn)
      : busn.localeCompare(ausn);
  });

  const filteredAttempts = sortedAttempts.filter((a) =>
    matchesSearch(a, searchTerm)
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAttempts.length / PAGE_SIZE)
  );

  const safePage = Math.min(page, totalPages);

  const paginatedAttempts = filteredAttempts.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  // Leaderboard data (always highest first)
  const leaderboardAttempts = [...attempts]
    .sort((a, b) => {
      const ap = a.percentage || 0;
      const bp = b.percentage || 0;
      if (bp !== ap) return bp - ap;
      const at = a.totalMarks || 0;
      const bt = b.totalMarks || 0;
      if (bt !== at) return bt - at;
      return (a.studentName || '').localeCompare(b.studentName || '');
    })
    .slice(0, Math.min(leaderboardCount || 1, attempts.length));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/results')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Results
              </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Quiz Results
            </h1>
            <p className="text-lg text-muted-foreground">
              {quizTitle}
              {autoRefresh && (
                <span className="ml-2 text-xs">
                  (Auto-refreshing every 10s)
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-col gap-2 items-end">
            <div className="flex flex-wrap gap-2 justify-end">
              {/* View mode toggle */}
              <div className="flex rounded-md border bg-muted/60 p-1">
                <Button
                  size="sm"
                  variant={viewMode === 'results' ? 'default' : 'ghost'}
                  className="rounded-md"
                  onClick={() => setViewMode('results')}
                >
                  Results
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'leaderboard' ? 'default' : 'ghost'}
                  className="rounded-md"
                  onClick={() => setViewMode('leaderboard')}
                >
                  Leaderboard
                </Button>
              </div>

              <Button
                onClick={() => setAutoRefresh((v) => !v)}
                variant={autoRefresh ? 'default' : 'outline'}
                size="sm"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${
                    autoRefresh ? 'animate-spin' : ''
                  }`}
                />
                {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                onClick={() => handleDownloadExcel(false)}
                disabled={downloading || attempts.length === 0}
              >
                {downloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Download Summary
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleDownloadExcel(true)}
                disabled={downloading || attempts.length === 0}
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" />
                Detailed Report
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Students
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{attempts.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Average Score
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.avgPercentage}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Pass Rate
                </CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.passRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  ≥40% to pass
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Score Range
                </CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {stats.lowestPercentage}% – {stats.highestPercentage}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Marks range: {stats.lowestMarks} – {stats.highestMarks}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* View: Results / Leaderboard */}
        {viewMode === 'results' ? (
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Student Results</CardTitle>
                <CardDescription>
                  {attempts.length > 0
                    ? `${attempts.length} student(s) attempted this quiz`
                    : 'No attempts yet'}
                </CardDescription>
              </div>

              {/* Search + Sort controls */}
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search by name, USN, branch..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    className="h-9 w-full md:w-64 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm">
                  <span className="text-muted-foreground">Sort by</span>
                  <select
                    value={sortKey}
                    onChange={(e) =>
                      setSortKey(e.target.value as SortKey)
                    }
                    className="h-9 rounded-md border border-input bg-background px-2 py-1 text-xs md:text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="usn">USN</option>
                    <option value="name">Name</option>
                    <option value="percentage">Percentage</option>
                  </select>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    onClick={() =>
                      setSortOrder((prev) =>
                        prev === 'asc' ? 'desc' : 'asc'
                      )
                    }
                    title={
                      sortOrder === 'asc'
                        ? 'Ascending'
                        : 'Descending'
                    }
                  >
                    <span className="text-xs font-semibold">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {attempts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No Results Yet
                  </h3>
                  <p className="text-muted-foreground">
                    Students haven't attempted this quiz yet.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student Name</TableHead>
                          <TableHead>USN</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead>Year/Sem</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Percentage</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedAttempts.map((attempt) => (
                          <TableRow
                            key={attempt._id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => openAttemptDetail(attempt)}
                          >
                            <TableCell className="font-medium">
                              {attempt.studentName}
                            </TableCell>
                            <TableCell>{attempt.studentUSN}</TableCell>
                            <TableCell>{attempt.studentBranch}</TableCell>
                            <TableCell>
                              {attempt.studentYear}/{attempt.studentSemester}
                            </TableCell>
                            <TableCell>
                              {attempt.totalMarks}/{attempt.maxMarks}
                            </TableCell>
                            <TableCell>
                              <span
                                className={
                                  (attempt.percentage || 0) >= 40
                                    ? 'text-green-600 font-semibold'
                                    : 'text-red-600 font-semibold'
                                }
                              >
                                {Number.isFinite(attempt.percentage)
                                  ? attempt.percentage.toFixed(1)
                                  : '0.0'}
                                %
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  attempt.status === 'graded'
                                    ? 'default'
                                    : 'secondary'
                                }
                              >
                                {attempt.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {attempt.submittedAt
                                ? new Date(
                                    attempt.submittedAt
                                  ).toLocaleString()
                                : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination controls */}
                  {filteredAttempts.length > 0 && totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground flex-wrap gap-2">
                      <div>
                        Showing{' '}
                        <span className="font-semibold">
                          {(safePage - 1) * PAGE_SIZE + 1}
                        </span>{' '}
                        –{' '}
                        <span className="font-semibold">
                          {Math.min(
                            safePage * PAGE_SIZE,
                            filteredAttempts.length
                          )}
                        </span>{' '}
                        of{' '}
                        <span className="font-semibold">
                          {filteredAttempts.length}
                        </span>{' '}
                        students
                        {searchTerm && (
                          <span className="ml-1 text-xs">
                            (filtered from {attempts.length} total)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={safePage === 1}
                          onClick={() =>
                            setPage((p) => Math.max(1, p - 1))
                          }
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span>
                          Page{' '}
                          <span className="font-semibold">
                            {safePage}
                          </span>{' '}
                          of{' '}
                          <span className="font-semibold">
                            {totalPages}
                          </span>
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={safePage === totalPages}
                          onClick={() =>
                            setPage((p) =>
                              Math.min(totalPages, p + 1)
                            )
                          }
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          // ---------------- LEADERBOARD VIEW ----------------
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>
                  View top performers based on highest score / percentage.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    Show Top
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={attempts.length || 1}
                    value={leaderboardCount || ''}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (Number.isNaN(val)) {
                        setLeaderboardCount(0);
                      } else {
                        setLeaderboardCount(
                          Math.max(1, Math.min(val, attempts.length || 1))
                        );
                      }
                    }}
                    className="h-9 w-16 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                  <span className="text-muted-foreground">students</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setLeaderboardCount(5)}
                  >
                    Top 5
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setLeaderboardCount(10)}
                  >
                    Top 10
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setLeaderboardCount(20)}
                    disabled={attempts.length < 20}
                  >
                    Top 20
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {attempts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No Results Yet
                  </h3>
                  <p className="text-muted-foreground">
                    Leaderboard will be available once students attempt
                    this quiz.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rank</TableHead>
                          <TableHead>Student Name</TableHead>
                          <TableHead>USN</TableHead>
                          <TableHead>Branch</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Percentage</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaderboardAttempts.map((attempt, index) => {
                          const rank = index + 1;
                          const isTop1 = rank === 1;
                          const isTop3 = rank <= 3;

                          return (
                            <TableRow
                              key={attempt._id}
                              className={`cursor-pointer hover:bg-muted/60 ${
                                isTop1
                                  ? 'bg-yellow-50/80'
                                  : isTop3
                                  ? 'bg-emerald-50/50'
                                  : ''
                              }`}
                              onClick={() => openAttemptDetail(attempt)}
                            >
                              <TableCell className="font-semibold">
                                <div className="flex items-center gap-2">
                                  <span>{rank}</span>
                                  {isTop1 && (
                                    <span className="inline-flex items-center rounded-full bg-yellow-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white tracking-wide">
                                      Top 1
                                    </span>
                                  )}
                                  {!isTop1 && isTop3 && (
                                    <span className="inline-flex items-center rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white tracking-wide">
                                      Top {rank}
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">
                                {attempt.studentName}
                              </TableCell>
                              <TableCell>{attempt.studentUSN}</TableCell>
                              <TableCell>{attempt.studentBranch}</TableCell>
                              <TableCell>
                                {attempt.totalMarks}/{attempt.maxMarks}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={
                                    (attempt.percentage || 0) >= 40
                                      ? 'text-green-600 font-semibold'
                                      : 'text-red-600 font-semibold'
                                  }
                                >
                                  {Number.isFinite(attempt.percentage)
                                    ? attempt.percentage.toFixed(1)
                                    : '0.0'}
                                  %
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    attempt.status === 'graded'
                                      ? 'default'
                                      : 'secondary'
                                  }
                                >
                                  {attempt.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leaderboard is sorted by percentage (highest first), then
                    by total marks, then by name.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setAttemptDetail(null);
            setSelectedAttempt(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitleUI>Student Answers</DialogTitleUI>
            <DialogDescription>
              {selectedAttempt
                ? `${selectedAttempt.studentName} • ${selectedAttempt.studentUSN}`
                : 'View selected answers and correct options'}
            </DialogDescription>
          </DialogHeader>

          {detailLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {!detailLoading && attemptDetail && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-4 py-3 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">{quizTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    Submitted:{' '}
                    {attemptDetail.submittedAt
                      ? new Date(
                          attemptDetail.submittedAt
                        ).toLocaleString()
                      : '-'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="font-semibold">
                    Score: {attemptDetail.totalMarks}/
                    {attemptDetail.maxMarks}
                  </span>
                  <span
                    className={
                      attemptDetail.percentage >= 40
                        ? 'font-semibold text-green-600'
                        : 'font-semibold text-red-600'
                    }
                  >
                    {Number.isFinite(attemptDetail.percentage)
                      ? attemptDetail.percentage.toFixed(1)
                      : '0.0'}
                    %
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {attemptDetail.questions.map((q, index) => {
                  const options = q.options || [];

                  const selectedIdx = options.findIndex(
                    (opt) => normalize(opt) === normalize(q.studentAnswer)
                  );
                  const correctIdx = options.findIndex(
                    (opt) => normalize(opt) === normalize(q.correctAnswer)
                  );
                  const isMcq = q.type === 'mcq' && options.length > 0;

                  // use backend isCorrect OR computed equality
                  const isCorrect =
                    q.isCorrect ||
                    (isMcq &&
                      selectedIdx >= 0 &&
                      correctIdx >= 0 &&
                      selectedIdx === correctIdx);

                  const selectedLabel =
                    selectedIdx >= 0
                      ? `${optionLabel(selectedIdx)}. ${options[selectedIdx]}`
                      : q.studentAnswer
                      ? q.studentAnswer
                      : 'No answer';

                  const correctLabel =
                    correctIdx >= 0
                      ? `${optionLabel(correctIdx)}. ${options[correctIdx]}`
                      : q.correctAnswer || '-';

                  return (
                    <Card
                      key={q._id || index}
                      className={
                        isCorrect
                          ? 'border-green-500/70 bg-green-50/60'
                          : 'border-red-500/70 bg-red-50/50'
                      }
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-sm font-semibold">
                              Q{index + 1}. {q.questionText}
                            </CardTitle>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Marks: {q.marks}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 text-xs font-semibold">
                            {isCorrect ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-green-700">
                                  Correct
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-red-600" />
                                <span className="text-red-700">
                                  Incorrect
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-2">
                        {isMcq ? (
                          <>
                            {/* Summary row */}
                            <div className="mb-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-muted px-2 py-1">
                                <span className="font-semibold">
                                  Selected:
                                </span>{' '}
                                {selectedLabel}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-1">
                                <span className="font-semibold">
                                  Correct:
                                </span>{' '}
                                {correctLabel}
                              </span>
                            </div>

                            {/* Options with circle indicator */}
                            {options.map((option, idx) => {
                              const isSelected = idx === selectedIdx;
                              const isCorrectOption = idx === correctIdx;

                              let optionClass =
                                'flex items-center gap-3 rounded-md border px-3 py-2 text-sm';

                              if (isCorrectOption) {
                                optionClass +=
                                  ' border-green-500 bg-green-100/80 font-medium';
                              } else if (isSelected && !isCorrectOption) {
                                optionClass +=
                                  ' border-red-500 bg-red-100/80 font-medium';
                              } else {
                                optionClass +=
                                  ' border-muted bg-background';
                              }

                              let circleClass =
                                'h-4 w-4 rounded-full border flex items-center justify-center';
                              if (isCorrectOption) {
                                circleClass +=
                                  ' border-green-600 bg-green-600';
                              } else if (isSelected) {
                                circleClass +=
                                  ' border-red-600 bg-red-600';
                              } else {
                                circleClass +=
                                  ' border-muted-foreground';
                              }

                              return (
                                <div key={idx} className={optionClass}>
                                  <span className={circleClass} />
                                  <span className="font-semibold mr-1">
                                    {optionLabel(idx)}.
                                  </span>
                                  <span>{option}</span>
                                  {isSelected && (
                                    <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                                      Selected
                                    </span>
                                  )}
                                  {isCorrectOption && (
                                    <span className="ml-2 rounded-full bg-green-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                                      Correct
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          // short-answer
                          <div className="space-y-2 text-sm">
                            <div
                              className={
                                'rounded-md border px-3 py-2 ' +
                                (isCorrect
                                  ? 'border-green-500 bg-green-100/80'
                                  : 'border-red-500 bg-red-100/80')
                              }
                            >
                              <p className="text-xs font-semibold mb-1">
                                Student Answer
                              </p>
                              <p>
                                {q.studentAnswer || (
                                  <span className="italic text-muted-foreground">
                                    No answer
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="rounded-md border px-3 py-2 border-muted bg-background">
                              <p className="text-xs font-semibold mb-1">
                                Correct Answer
                              </p>
                              <p>{q.correctAnswer || '-'}</p>
                            </div>
                          </div>
                        )}

                        {q.explanation && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Explanation: {q.explanation}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
