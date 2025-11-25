import { useState, useEffect } from 'react';
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { StudentTable } from '@/components/StudentTable';
import { parseExcelFile, generateSampleExcel } from '@/services/excelService';
import { studentsAPI } from '@/services/api';
import type { Student } from '@/types';
import { toast } from 'sonner';

const UPLOAD_BATCH_SIZE = 500; // how many students per /students/upload call

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{
    processed: number;
    total: number;
  } | null>(null);

  // ---- EDIT DIALOG STATE ----
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<{
    name: string;
    usn: string;
    email: string;
    branch: string;
    year: string;
    semester: string;
  }>({
    name: '',
    usn: '',
    email: '',
    branch: '',
    year: '',
    semester: '',
  });

  // ---- CREATE (ADD) DIALOG STATE ----
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addForm, setAddForm] = useState<{
    name: string;
    usn: string;
    email: string;
    branch: string;
    year: string;
    semester: string;
  }>({
    name: '',
    usn: '',
    email: '',
    branch: '',
    year: '',
    semester: '',
  });

  // helper to get an id for API calls
  const getStudentId = (student: Student): string =>
    (student as any)._id || (student as any).id || student.email;

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await studentsAPI.getAll();
        setStudents(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching students:', error);
        toast.error('Failed to load students');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  // ---- FILE UPLOAD LOGIC ----
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setErrors([]);
    setSuccess(false);
    setUploadProgress(null);

    try {
      const result = await parseExcelFile(file);

      if (!result.isValid) {
        setErrors(result.errors);
        toast.error('Validation errors found in Excel file');
        return;
      }

      const allStudents: Student[] = result.students || [];
      const total = allStudents.length;

      if (total === 0) {
        toast.error('No valid students found in file');
        return;
      }

      // Upload in batches to avoid huge single request
      for (let i = 0; i < total; i += UPLOAD_BATCH_SIZE) {
        const chunk = allStudents.slice(i, i + UPLOAD_BATCH_SIZE);
        setUploadProgress({
          processed: Math.min(i + chunk.length, total),
          total,
        });

        await studentsAPI.upload(chunk);
      }

      // Refresh student list once at the end
      const updatedStudents = await studentsAPI.getAll();
      setStudents(Array.isArray(updatedStudents) ? updatedStudents : []);

      setSuccess(true);
      toast.success(`Successfully uploaded ${total} student records`);

      // Clear file input
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading students:', error);
      toast.error('Failed to upload students');
      setErrors([error instanceof Error ? error.message : 'Upload failed']);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  };

  // ---- EDIT LOGIC ----
  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    setEditForm({
      name: student.name ?? '',
      usn: student.usn ?? '',
      email: student.email ?? '',
      branch: student.branch ?? '',
      year: student.year != null ? String(student.year) : '',
      semester: student.semester != null ? String(student.semester) : '',
    });
  };

  const closeEditDialog = () => {
    setEditingStudent(null);
    setSavingEdit(false);
  };

  const handleEditInputChange = (
    field: keyof typeof editForm,
    value: string
  ) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingStudent) return;
    setSavingEdit(true);

    try {
      const id = getStudentId(editingStudent);

      const updatedStudent: Student = {
        ...editingStudent,
        name: editForm.name.trim(),
        usn: editForm.usn.trim(),
        email: editForm.email.trim(),
        branch: editForm.branch.trim(),
        // keep compatibility with possible string/number variants
        year: editForm.year ? (editForm.year as any) : (editingStudent as any).year,
        semester: editForm.semester
          ? (editForm.semester as any)
          : (editingStudent as any).semester,
      };

      const res = await studentsAPI.update(id, updatedStudent);

      // update local state with data from server (in case hooks/middleware modified it)
      setStudents((prev) =>
        prev.map((s) =>
          getStudentId(s) === id ? res : s
        )
      );

      toast.success('Student updated successfully');
      closeEditDialog();
    } catch (error) {
      console.error('Error updating student:', error);
      toast.error('Failed to update student');
      setSavingEdit(false);
    }
  };

  // ---- ADD / INSERT LOGIC ----
  const openAddDialog = () => {
    setAddForm({
      name: '',
      usn: '',
      email: '',
      branch: '',
      year: '',
      semester: '',
    });
    setAddDialogOpen(true);
  };

  const closeAddDialog = () => {
    setAddDialogOpen(false);
    setSavingAdd(false);
  };

  const handleAddInputChange = (
    field: keyof typeof addForm,
    value: string
  ) => {
    setAddForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateStudent = async () => {
    // simple required field validation
    if (!addForm.name.trim() || !addForm.usn.trim() || !addForm.email.trim()) {
      toast.error('Name, USN and Email are required');
      return;
    }

    setSavingAdd(true);

    try {
      const payload = {
        name: addForm.name.trim(),
        usn: addForm.usn.trim(),
        email: addForm.email.trim(),
        branch: addForm.branch.trim(),
        year: addForm.year.trim(),
        semester: addForm.semester.trim(),
      };

      // backend returns the created student document
      const created = await studentsAPI.create(payload);

      setStudents((prev) => [...prev, created]);
      toast.success('Student created successfully');
      closeAddDialog();
    } catch (error) {
      console.error('Error creating student:', error);
      toast.error('Failed to create student');
      setSavingAdd(false);
    }
  };

  // ---- DELETE LOGIC ----
  const handleDeleteStudent = async (student: Student) => {
    const id = getStudentId(student);
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${student.name || student.email}?`
    );
    if (!confirmDelete) return;

    try {
      await studentsAPI.delete(id);
      setStudents((prev) => prev.filter((s) => getStudentId(s) !== id));
      toast.success('Student deleted successfully');
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.error('Failed to delete student');
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

      {/* Upload + Manual Insert Section */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Student Excel
          </CardTitle>
          <CardDescription>
            Upload an Excel file (.xlsx or .csv) containing student information
            or insert students manually.
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
                    <li key={i} className="text-sm">
                      {error}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Students uploaded successfully! {students.length} records in the system.
              </AlertDescription>
            </Alert>
          )}

          {uploadProgress && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                Uploading in batches... {uploadProgress.processed}/{uploadProgress.total} students processed
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

            {/* Manual Insert Button */}
            <Button
              variant="secondary"
              onClick={openAddDialog}
              className="flex-1 sm:flex-initial"
            >
              + Add Student Manually
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Student Table */}
      {students.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Student Records</CardTitle>
              <CardDescription>Total: {students.length} students</CardDescription>
            </div>
            <Button size="sm" onClick={openAddDialog}>
              + Add Student
            </Button>
          </CardHeader>
          <CardContent>
            <StudentTable
              students={students}
              enableActions
              onEditStudent={openEditDialog}
              onDeleteStudent={handleDeleteStudent}
            />
          </CardContent>
        </Card>
      )}

      {/* Edit Student Dialog */}
      <Dialog
        open={!!editingStudent}
        onOpenChange={(open) => {
          if (!open) closeEditDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update the student details and save your changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  handleEditInputChange('name', e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">USN</label>
              <Input
                value={editForm.usn}
                onChange={(e) =>
                  handleEditInputChange('usn', e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input
                value={editForm.email}
                onChange={(e) =>
                  handleEditInputChange('email', e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Branch</label>
              <Input
                value={editForm.branch}
                onChange={(e) =>
                  handleEditInputChange('branch', e.target.value)
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Year</label>
                <Input
                  value={editForm.year}
                  onChange={(e) =>
                    handleEditInputChange('year', e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Semester</label>
                <Input
                  value={editForm.semester}
                  onChange={(e) =>
                    handleEditInputChange('semester', e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={closeEditDialog}
              type="button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit}
              type="button"
            >
              {savingEdit ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Insert Student Dialog */}
      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeAddDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>
              Fill in the student details and save to insert manually.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={addForm.name}
                onChange={(e) =>
                  handleAddInputChange('name', e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">USN *</label>
              <Input
                value={addForm.usn}
                onChange={(e) =>
                  handleAddInputChange('usn', e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email *</label>
              <Input
                value={addForm.email}
                onChange={(e) =>
                  handleAddInputChange('email', e.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Branch</label>
              <Input
                value={addForm.branch}
                onChange={(e) =>
                  handleAddInputChange('branch', e.target.value)
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Year</label>
                <Input
                  value={addForm.year}
                  onChange={(e) =>
                    handleAddInputChange('year', e.target.value)
                  }
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Semester</label>
                <Input
                  value={addForm.semester}
                  onChange={(e) =>
                    handleAddInputChange('semester', e.target.value)
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={closeAddDialog}
              type="button"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateStudent}
              disabled={savingAdd}
              type="button"
            >
              {savingAdd ? 'Saving...' : 'Save student'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
