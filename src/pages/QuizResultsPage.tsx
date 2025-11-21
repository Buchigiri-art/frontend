import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/use-toast';
import { Download, ArrowLeft, Loader2, FileSpreadsheet, Users, Award, TrendingUp, RefreshCw } from 'lucide-react';
import { quizAPI } from '@/services/api';
import axios from 'axios';

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

export default function QuizResultsPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [quizTitle, setQuizTitle] = useState('');
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);

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
        `${API_URL}/quiz/${quizId}/results/download${detailed ? '?detailed=true' : ''}`,
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
      link.setAttribute('download', `${quizTitle.replace(/[^a-z0-9]/gi, '_')}_results.xlsx`);
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

    const avgPercentage = attempts.reduce((sum, a) => sum + a.percentage, 0) / attempts.length;
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
              {autoRefresh && <span className="ml-2 text-xs">(Auto-refreshing every 10s)</span>}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
              {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
            </Button>
            <Button onClick={() => handleDownloadExcel(false)} disabled={downloading || attempts.length === 0}>
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
            <Button onClick={() => handleDownloadExcel(true)} disabled={downloading || attempts.length === 0} variant="outline">
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
              {attempts.length > 0 ? `${attempts.length} student(s) attempted this quiz` : 'No attempts yet'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Results Yet</h3>
                <p className="text-muted-foreground">Students haven't attempted this quiz yet.</p>
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
                      <TableRow key={attempt._id}>
                        <TableCell className="font-medium">{attempt.studentName}</TableCell>
                        <TableCell>{attempt.studentUSN}</TableCell>
                        <TableCell>{attempt.studentBranch}</TableCell>
                        <TableCell>
                          {attempt.studentYear}/{attempt.studentSemester}
                        </TableCell>
                        <TableCell>
                          {attempt.totalMarks}/{attempt.maxMarks}
                        </TableCell>
                        <TableCell>
                          <span className={attempt.percentage >= 40 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {attempt.percentage.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={attempt.status === 'graded' ? 'default' : 'secondary'}>
                            {attempt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(attempt.submittedAt).toLocaleString()}
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
    </div>
  );
}
