import { useState, useEffect } from 'react';
import { Upload, Download, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { StudentTable } from '@/components/StudentTable';
import { parseExcelFile, generateSampleExcel } from '@/services/excelService';
import { studentsAPI } from '@/services/api';
import { Student } from '@/types';
import { toast } from 'sonner';

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await studentsAPI.getAll();
        setStudents(data);
      } catch (error) {
        console.error('Error fetching students:', error);
        toast.error('Failed to load students');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrors([]);
    setSuccess(false);

    try {
      const result = await parseExcelFile(file);

      if (!result.isValid) {
        setErrors(result.errors);
        toast.error('Validation errors found in Excel file');
        return;
      }

      // Upload to backend
      await studentsAPI.upload(result.students);
      
      // Refresh student list
      const updatedStudents = await studentsAPI.getAll();
      setStudents(updatedStudents);
      setSuccess(true);
      toast.success(`Successfully uploaded ${result.students.length} student records`);
      
      // Clear file input
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading students:', error);
      toast.error('Failed to upload students');
      setErrors([error instanceof Error ? error.message : 'Upload failed']);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Student Management</h1>
        <p className="text-muted-foreground">
          Upload and manage student records for quiz distribution
        </p>
      </div>

      {/* Upload Section */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Student Excel
          </CardTitle>
          <CardDescription>
            Upload an Excel file (.xlsx or .csv) containing student information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Messages */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-semibold mb-1">Validation Errors:</p>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, i) => (
                    <li key={i} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Students uploaded successfully! {students.length} records added.
              </AlertDescription>
            </Alert>
          )}

          {/* Required Format Info */}
          <div className="bg-muted/50 p-4 rounded-lg border">
            <h4 className="font-semibold mb-2 text-sm">Required Excel Columns:</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Name</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>USN</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Email</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Branch</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Year</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Semester</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <label className="flex-1">
              <Button
                className="w-full gradient-primary hover:opacity-90"
                disabled={uploading}
                asChild
              >
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? 'Uploading...' : 'Upload Student Excel'}
                </span>
              </Button>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>

            <Button
              variant="outline"
              onClick={generateSampleExcel}
              className="flex-1 sm:flex-initial"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Sample
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Student Table */}
      {students.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Student Records</CardTitle>
            <CardDescription>
              Total: {students.length} students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StudentTable students={students} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
