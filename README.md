# SmartQuizAI - Faculty Module

A professional React-based web application for faculty members to manage students, generate AI-powered quiz questions using Google Gemini, and distribute quizzes efficiently.

## 🚀 Features

- **Professional Authentication**: Secure login system with dummy credentials for testing
- **Student Management**: Upload Excel files with student data, view, search, and filter records
- **AI-Powered Quiz Generation**: Generate questions using Google Gemini AI
- **Question Management**: Edit, bookmark, and organize AI-generated questions
- **Quiz Distribution**: Select students and generate shareable quiz links
- **Local Persistence**: Data saved in localStorage with backend integration ready
- **Responsive Design**: Beautiful, modern UI that works on all devices

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **AI Integration**: Google Generative AI (Gemini)
- **Excel Parsing**: xlsx library
- **HTTP Client**: axios
- **State Management**: React hooks + localStorage

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- **Google Gemini API key (REQUIRED for AI quiz generation)**

## 🔧 Installation & Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd smartquizai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Your Gemini API Key (REQUIRED)

**The `.env` file is already created with your API key configured!**

If you need to update it, edit the `.env` file in the root directory:

```env
# Your Gemini API key for AI question generation
VITE_GEMINI_API_KEY=AIzaSyBFABBifL3Yz7x2pv5mP_3bu8Fk0i3x_Uc

# Optional: Backend API URL (defaults to localhost:3001)
VITE_API_URL=http://localhost:3001/api
```

**How to get a Gemini API key:**
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to `.env`

⚠️ **SECURITY NOTE**: Never commit `.env` files to version control. Your API key should remain private.

### 4. Run the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:8080`

## 👤 Demo Credentials

Use these credentials to log in:

- **Email**: `admin@college.edu`
- **Password**: `Admin@123`

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── LoginCard.tsx
│   ├── Sidebar.tsx
│   ├── StudentTable.tsx
│   ├── QuestionEditor.tsx
│   ├── ProtectedRoute.tsx
│   └── DashboardLayout.tsx
├── pages/              # Page components
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── StudentsPage.tsx
│   ├── CreateQuizPage.tsx
│   └── BookmarksPage.tsx
├── services/           # API and business logic
│   ├── gemini.ts       # Gemini AI integration
│   ├── excelService.ts # Excel parsing
│   └── api.ts          # Backend API calls
├── hooks/              # Custom React hooks
│   ├── useAuth.ts
│   └── useLocalStorage.ts
├── types/              # TypeScript type definitions
│   └── index.ts
└── utils/              # Helper functions
    └── validators.ts
```

## 📊 Excel File Format

Your student Excel file must include these columns (case-insensitive):

| Column   | Description                  | Example             |
|----------|------------------------------|---------------------|
| Name     | Student's full name          | John Doe            |
| USN      | University Serial Number     | 1CR21CS001          |
| Email    | Student's email address      | john@example.com    |
| Branch   | Department/Branch            | Computer Science    |
| Year     | Current academic year        | 3                   |
| Semester | Current semester             | 5                   |

**Download a sample Excel file** from the Students page in the app.

## 🤖 Using AI Question Generation

### With Gemini API Key

1. Add your API key to `.env` as shown above
2. Navigate to "Create Quiz" page
3. Upload a module file (TXT/MD) or paste content
4. Set the number of questions and type
5. Click "Generate Questions (Gemini)"

### Without API Key (Demo Mode)

The app will automatically use demo questions if no API key is configured. This is perfect for testing the UI and workflow.

## 💾 Backend Integration (Optional)

The frontend includes stub endpoints for backend integration. To connect a real backend:

### Backend Stub Example (Node.js + Express)

Create a simple backend stub:

```bash
mkdir backend
cd backend
npm init -y
npm install express cors body-parser
```

Create `backend/index.js`:

```javascript
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Save quiz endpoint
app.post('/api/quiz/save', (req, res) => {
  console.log('Quiz saved:', req.body);
  res.json({ success: true, quizId: req.body.id });
});

// Share quiz endpoint
app.post('/api/quiz/share', (req, res) => {
  const { quizId, studentEmails } = req.body;
  const links = studentEmails.map(email => ({
    email,
    link: `https://smartquizai.app/attempt/${quizId}?token=${Buffer.from(email).toString('base64')}`,
    token: Buffer.from(email).toString('base64')
  }));
  
  console.log('Quiz shared with:', studentEmails);
  res.json({ success: true, message: 'Links generated', links });
});

// Upload students endpoint
app.post('/api/students/upload', (req, res) => {
  console.log('Students uploaded:', req.body.students.length);
  res.json({ success: true, count: req.body.students.length });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
```

Run the backend:

```bash
node index.js
```

### Adding Email Functionality (Optional)

To send actual emails, add Nodemailer:

```bash
npm install nodemailer
```

Update the share endpoint:

```javascript
const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your-email@gmail.com',
    pass: 'your-app-password'
  }
});

app.post('/api/quiz/share', async (req, res) => {
  const { quizId, studentEmails } = req.body;
  const links = studentEmails.map(email => ({
    email,
    link: `https://smartquizai.app/attempt/${quizId}?token=${Buffer.from(email).toString('base64')}`,
    token: Buffer.from(email).toString('base64')
  }));
  
  // Send emails (uncomment when configured)
  /*
  for (const linkData of links) {
    await transporter.sendMail({
      from: 'your-email@gmail.com',
      to: linkData.email,
      subject: 'New Quiz Available',
      html: `<p>Click here to take the quiz: <a href="${linkData.link}">${linkData.link}</a></p>`
    });
  }
  */
  
  res.json({ success: true, message: 'Links generated & emails sent', links });
});
```

## 🎯 Key Features Explained

### Question Types

1. **Multiple Choice (MCQ)**: 4 options with one correct answer
2. **Short Answer**: Free-text response with expected answer
3. **Mixed**: Combination of MCQ and short answer

### Bookmarking System

- Click the bookmark icon on any question to save it
- Access all bookmarks from the "Bookmarks" page
- Export bookmarked questions as JSON
- Edit or remove bookmarks anytime

### Quiz Sharing

1. Generate questions
2. Select questions to include
3. Click "Share Quiz"
4. Select students from your uploaded list
5. Generate unique links for each student

## 🔒 Security Notes

- Never commit `.env` files to version control
- The included authentication is for demo purposes only
- Implement proper JWT authentication for production
- Use HTTPS in production
- Validate all user inputs on the backend
- Implement rate limiting for AI API calls

## 📦 Building for Production

```bash
npm run build
```

The optimized production build will be in the `dist/` directory.

## 🐛 Troubleshooting

### Excel Upload Issues

- Ensure all required columns are present
- Check for empty rows or cells
- Verify email format validity

### AI Generation Errors

- **"API key not configured"**: Add `VITE_GEMINI_API_KEY` to `.env`
- **"Invalid API key"**: Verify your Gemini API key is correct
- **Rate limit errors**: Wait a few moments between requests

### Backend Connection Issues

- Ensure backend is running on correct port
- Check CORS is enabled in backend
- Verify `VITE_API_URL` in `.env` matches backend URL

## 🚀 Future Enhancements

- [ ] Database integration (MongoDB/PostgreSQL)
- [ ] Real authentication with JWT
- [ ] Quiz attempt tracking and analytics
- [ ] Automatic grading for short answers
- [ ] PDF module parsing support
- [ ] Question bank management
- [ ] Advanced filtering and search
- [ ] Email notifications
- [ ] Export to PDF

## 📄 License

MIT License - feel free to use this project for educational purposes.

## 🤝 Support

For issues or questions:
1. Check this README thoroughly
2. Review the console for error messages
3. Verify your `.env` configuration
4. Check that all dependencies are installed

## ✨ Credits

Built with React, Vite, Tailwind CSS, shadcn/ui, and Google Gemini AI.

---

**Happy Teaching! 🎓**
