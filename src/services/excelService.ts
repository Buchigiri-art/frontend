import * as XLSX from 'xlsx';
import { Student } from '@/types';

export interface ExcelValidationResult {
  isValid: boolean;
  errors: string[];
  students: Student[];
}

const REQUIRED_HEADERS = ['Name', 'USN', 'Email', 'Branch', 'Year', 'Semester'];

export async function parseExcelFile(file: File): Promise<ExcelValidationResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

        if (jsonData.length === 0) {
          resolve({
            isValid: false,
            errors: ['Excel file is empty'],
            students: [],
          });
          return;
        }

        const headers = jsonData[0];
        const errors: string[] = [];

        // Validate headers
        const missingHeaders = REQUIRED_HEADERS.filter(
          (required) => !headers.some((header) => 
            header?.toLowerCase().trim() === required.toLowerCase()
          )
        );

        if (missingHeaders.length > 0) {
          errors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
        }

        // Map headers to indices
        const headerMap = REQUIRED_HEADERS.reduce((acc, header) => {
          const index = headers.findIndex(
            (h) => h?.toLowerCase().trim() === header.toLowerCase()
          );
          acc[header] = index;
          return acc;
        }, {} as Record<string, number>);

        // Parse students
        const students: Student[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.every((cell) => !cell)) continue; // Skip empty rows

          const student: Student = {
            id: `student-${i}`,
            name: row[headerMap['Name']]?.toString().trim() || '',
            usn: row[headerMap['USN']]?.toString().trim() || '',
            email: row[headerMap['Email']]?.toString().trim() || '',
            branch: row[headerMap['Branch']]?.toString().trim() || '',
            year: row[headerMap['Year']]?.toString().trim() || '',
            semester: row[headerMap['Semester']]?.toString().trim() || '',
          };

          // Validate email format
          if (student.email && !isValidEmail(student.email)) {
            errors.push(`Row ${i + 1}: Invalid email format - ${student.email}`);
          }

          // Check for missing required fields
          const emptyFields = Object.entries(student)
            .filter(([key, value]) => key !== 'id' && !value)
            .map(([key]) => key);

          if (emptyFields.length > 0) {
            errors.push(`Row ${i + 1}: Missing fields - ${emptyFields.join(', ')}`);
          }

          students.push(student);
        }

        resolve({
          isValid: errors.length === 0,
          errors,
          students,
        });
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsBinaryString(file);
  });
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function generateSampleExcel(): void {
  const sampleData = [
    ['Name', 'USN', 'Email', 'Branch', 'Year', 'Semester'],
    ['John Doe', '1CR21CS001', 'john.doe@example.com', 'Computer Science', '3', '5'],
    ['Jane Smith', '1CR21CS002', 'jane.smith@example.com', 'Computer Science', '3', '5'],
    ['Alice Johnson', '1CR21EC001', 'alice.j@example.com', 'Electronics', '2', '4'],
    ['Bob Wilson', '1CR21ME001', 'bob.w@example.com', 'Mechanical', '4', '7'],
    ['Charlie Brown', '1CR21CS003', 'charlie.b@example.com', 'Computer Science', '3', '5'],
  ];

  const ws = XLSX.utils.aoa_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Students');

  // Generate and download the file
  XLSX.writeFile(wb, 'sample_students.xlsx');
}
