// src/pages/QuizResultsPage.tsx
import { useState, useEffect, useCallback } from 'react';
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
  Circle,
} from 'lucide-react';
import { quizAPI } from '@/services/api';
import axios from 'axios';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as DialogTitleUI,
  DialogDescription,
} from '@/components/ui/dialog';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
  selectedOptionIndex: number; // -1 if not matched
  correctOptionIndex: number;  // -1 if not matched
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

// Helper to show A/B/C/D labels
const optionLabel = (index: number) => String.fromCharCode(65 + index); // 0 -> A, 1 -> B, ...

export default function QuizResultsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttempt | null>(null);
  const [attemptDetail, setAttemptDetail] = useState<AttemptDetail | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      const data = await quizAPI.getResults(quizId!);
      setQuizTitle(data.quiz.title);
      setAttempts(data.attempts);
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
  }, [quizId]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Auto-refresh every 10 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchResults();
    }, 10000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchResults]);

  const handleDownloadExcel = async (detailed: boolean = false) => {
    setDownloading(true);
    try {
      const token = document.cookie
        .split('; ')
        .find((row) => row.startsWith('token='))
        ?.split('=')[1];

      const response = await axios.get(
        `${API_URL}/quiz/${quizId}/results/download${
          detailed ? '?detailed=true' : ''
        }`,
        {
          headers: {
            Cookie: `token=${token}`,
          },
          withCredentials: true,
          responseType: 'blob',
        }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `${quizTitle.replace(/[^a-z0-9]/gi, '_')}_results.xlsx`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();

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

  const calculateStats = () => {
    if (attempts.length === 0) return null;

    const avgPercentage =
      attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length;
    const passCount = attempts.filter((a) => a.percentage >= 40).length;
    const highestScore = Math.max(...attempts.map((a) => a.totalMarks));
    const lowestScore = Math.min(...attempts.map((a) => a.totalMarks));

    return {
      avgPercentage: avgPercentage.toFixed(2),
      passRate: ((passCount / attempts.length) * 100).toFixed(1),
      highestScore,
      lowestScore,
    };
  };

  const stats = calculateStats();

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
    } catch (error: any) {
      console.error('Error fetching attempt detail:', error);
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
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/results')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Results
              </Button>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Quiz Results</h1>
            <p className="text-lg text-muted-foreground">
              {quizTitle}
              {autoRefresh && (
                <span className="ml-2 text-xs">(Auto-refreshing every 10s)</span>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`}
              />
              {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
            </Button>
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

        {/* Statistics */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{attempts.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.avgPercentage}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.passRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">≥40% to pass</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Score Range</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.lowestScore} - {stats.highestScore}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Student Results</CardTitle>
            <CardDescription>
              {attempts.length > 0
                ? `${attempts.length} student(s) attempted this quiz`
                : 'No attempts yet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Results Yet</h3>
                <p className="text-muted-foreground">
                  Students haven't attempted this quiz yet.
                </p>
              </div>
            ) : (
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
                    {attempts.map((attempt) => (
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
                              attempt.percentage >= 40
                                ? 'text-green-600 font-semibold'
                                : 'text-red-600 font-semibold'
                            }
                          >
                            {attempt.percentage.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              attempt.status === 'graded' ? 'default' : 'secondary'
                            }
                          >
                            {attempt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {attempt.submittedAt
                            ? new Date(attempt.submittedAt).toLocaleString()
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attempt Detail Dialog */}
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
                      ? new Date(attemptDetail.submittedAt).toLocaleString()
                      : '-'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="font-semibold">
                    Score: {attemptDetail.totalMarks}/{attemptDetail.maxMarks}
                  </span>
                  <span
                    className={
                      attemptDetail.percentage >= 40
                        ? 'font-semibold text-green-600'
                        : 'font-semibold text-red-600'
                    }
                  >
                    {attemptDetail.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {attemptDetail.questions.map((q, index) => {
                  const isCorrect = q.isCorrect;

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
                                <span className="text-green-700">Correct</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="h-4 w-4 text-red-600" />
                                <span className="text-red-700">Incorrect</span>
                              </>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-2">
                        {/* MCQ view */}
                        {q.type === 'mcq' && q.options && q.options.length > 0 ? (
                          <>
                            {/* Summary badges just below question */}
                            <div className="mb-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-muted px-2 py-1">
                                <span className="font-semibold">Selected:</span>{' '}
                                {q.selectedOptionIndex >= 0
                                  ? `${optionLabel(q.selectedOptionIndex)}. ${
                                      q.options[q.selectedOptionIndex]
                                    }`
                                  : 'No answer'}
                              </span>
                              <span className="rounded-full bg-muted px-2 py-1">
                                <span className="font-semibold">Correct:</span>{' '}
                                {q.correctOptionIndex >= 0
                                  ? `${optionLabel(q.correctOptionIndex)}. ${
                                      q.options[q.correctOptionIndex]
                                    }`
                                  : '-'}
                              </span>
                            </div>

                            {/* Options list */}
                            {q.options.map((option, idx) => {
                              const isSelected = idx === q.selectedOptionIndex;
                              const isCorrectOption = idx === q.correctOptionIndex;

                              let optionClass =
                                'flex items-start gap-2 rounded-md border px-3 py-2 text-sm';

                              if (isCorrectOption) {
                                optionClass +=
                                  ' border-green-500 bg-green-100/80 font-medium';
                              } else if (isSelected && !isCorrectOption) {
                                optionClass +=
                                  ' border-red-500 bg-red-100/80 font-medium';
                              } else {
                                optionClass += ' border-muted bg-background';
                              }

                              return (
                                <div key={idx} className={optionClass}>
                                  <span className="mt-0.5">
                                    {isCorrectOption ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : isSelected ? (
                                      <XCircle className="h-4 w-4 text-red-600" />
                                    ) : (
                                      <Circle className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </span>
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
                          // Short-answer view
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
