// src/components/StudentTable.tsx
import React, { useMemo, useState } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import type { Student } from '@/types';

interface StudentTableProps {
  students: Student[];
  selectedStudents?: string[]; // array of emails
  onSelectionChange?: (selected: string[]) => void;
  showCheckboxes?: boolean;
}

export function StudentTable({
  students,
  selectedStudents = [],
  onSelectionChange,
  showCheckboxes = false
}: StudentTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [semesterFilter, setSemesterFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Unique filter values
  const branches = useMemo(() => Array.from(new Set(students.map(s => s.branch))).filter(Boolean).sort(), [students]);
  const years = useMemo(() => Array.from(new Set(students.map(s => s.year))).filter(Boolean).sort(), [students]);
  const semesters = useMemo(() => Array.from(new Set(students.map(s => s.semester))).filter(Boolean).sort(), [students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q || (
        (student.name || '').toLowerCase().includes(q) ||
        (student.usn || '').toLowerCase().includes(q) ||
        (student.email || '').toLowerCase().includes(q)
      );

      const matchesBranch = branchFilter === 'all' || student.branch === branchFilter;
      const matchesYear = yearFilter === 'all' || student.year === yearFilter;
      const matchesSemester = semesterFilter === 'all' || student.semester === semesterFilter;

      return matchesSearch && matchesBranch && matchesYear && matchesSemester;
    });
  }, [students, searchTerm, branchFilter, yearFilter, semesterFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, startIndex + itemsPerPage);

  // Selection helpers (emails used as keys)
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;

    if (checked) {
      const emails = filteredStudents.map(s => s.email).filter(Boolean);
      onSelectionChange(emails);
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectStudent = (email: string, checked: boolean) => {
    if (!onSelectionChange) return;

    if (checked) {
      if (!selectedStudents.includes(email)) {
        onSelectionChange([...selectedStudents, email]);
      }
    } else {
      onSelectionChange(selectedStudents.filter(e => e !== email));
    }
  };

  const isAllSelected = filteredStudents.length > 0 && filteredStudents.every(s => selectedStudents.includes(s.email));

  return (
    <div className="space-y-4">
      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, USN, or email..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2">
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map(branch => (
                <SelectItem key={branch} value={branch}>{branch}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map(year => (
                <SelectItem key={String(year)} value={String(year)}>Year {year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={semesterFilter} onValueChange={setSemesterFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Semesters</SelectItem>
              {semesters.map(sem => (
                <SelectItem key={String(sem)} value={String(sem)}>Sem {sem}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredStudents.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredStudents.length)} of {filteredStudents.length} students
        {showCheckboxes && selectedStudents.length > 0 && (
          <span className="ml-2 text-primary font-medium">({selectedStudents.length} selected)</span>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {showCheckboxes && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={(val) => handleSelectAll(!!val)}
                  />
                </TableHead>
              )}
              <TableHead>Name</TableHead>
              <TableHead>USN</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Semester</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showCheckboxes ? 7 : 6} className="text-center text-muted-foreground py-8">
                  No students found
                </TableCell>
              </TableRow>
            ) : (
              paginatedStudents.map(student => {
                // safe key: prefer _id, then id, then email
                const key = (student as any)._id || (student as any).id || student.email;

                return (
                  <TableRow key={key}>
                    {showCheckboxes && (
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.includes(student.email)}
                          onCheckedChange={(val) => handleSelectStudent(student.email, !!val)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell>{student.usn}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell>{student.branch}</TableCell>
                    <TableCell>{student.year}</TableCell>
                    <TableCell>{student.semester}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>

          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
