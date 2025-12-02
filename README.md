# AI Study Assistant

An intelligent study assistant platform that helps students manage study materials, generate summaries, notes, flashcards, and practice quizzes using AI-powered content generation.

## ✨ Features

### 🔐 Authentication & User Management
- **Multi-Provider Authentication**: Email/Password, Google OAuth, GitHub OAuth
- **Secure JWT-based session management**
- **User Profile Management**: Update username, email, password, view statistics
- **Password Recovery**: Forgot password with email verification

### 📄 Document Management
- **File Upload**: PDF and DOCX files (10MB max)
- **Automatic text extraction** and secure AWS S3 storage
- **Document organization**: Search, filter, delete documents

### 🤖 AI-Powered Content Generation
- **Summary**: Concise document overviews
- **Study Notes**: Detailed markdown notes (editable)
- **Flashcards**: 10 interactive cards per document with AI answer verification
- **Practice Quizzes**: 5 multiple-choice questions with refresh functionality
- **Q&A Chatbot**: Contextual document questions

### 📊 Analytics & Tracking
- **Study Analytics Dashboard**: Study time, quiz performance, flashcard mastery
- **Error Book**: Track wrong quiz answers with explanations
- **Study session tracking** and progress visualization

### 🛡️ Admin Features
- **Admin Dashboard**: System-wide statistics and usage metrics
- **User management** and access control

## 🛠 Technology Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes (Serverless)
- **Database**: MongoDB with Mongoose
- **AI**: Google Gemini 2.5 Flash Preview
- **Storage**: AWS S3 (files), AWS SES (email)
- **Authentication**: JWT, OAuth 2.0 (Google, GitHub)
- **Type Safety**: TypeScript

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone <repository-url>
cd ai-study-assistant
npm install
```

### 2. Set Up MongoDB Atlas
1. Create free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create cluster and database user
3. Whitelist your IP address
4. Get connection string

### 3. Configure Environment Variables
Create `.env.local` file:
```env
MONGODB_URI=your_mongodb_connection_string
GEMINI_API_KEY=your_gemini_api_key
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your_bucket_name
AWS_SES_FROM_EMAIL=verified_email@domain.com
JWT_SECRET=your_jwt_secret
ADMIN_EMAIL=admin@example.com
# Optional OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 4. Set Up AWS Services
- **S3 Bucket** for file storage
- **SES** for email notifications
- **IAM User** with appropriate permissions

### 5. Run the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

## 📖 Usage Guide

### Getting Started
1. **Register** with email verification
2. **Login** via email/password or OAuth
3. **Upload** PDF/DOCX documents
4. **Access AI-generated content**: summaries, notes, flashcards, quizzes
5. **Track progress** with analytics and error book

### Key Workflows
- **Flashcards**: Interactive practice with AI answer verification and mastery tracking
- **Quizzes**: Multiple-choice questions with instant feedback and error tracking
- **Study Analytics**: Visualize study time and performance metrics
- **Error Book**: Review and learn from wrong answers

## 🗂 Project Structure
```
ai-study-assistant/
├── app/
│   ├── api/                      # API routes
│   │   ├── auth/                 # Authentication
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── logout/
│   │   │   ├── me/
│   │   │   ├── forgot-password/
│   │   │   ├── reset-password/
│   │   │   ├── send-verification-code/
│   │   │   ├── verify-code/
│   │   │   └── oauth/            # OAuth (Google, GitHub)
│   │   ├── documents/            # Document management
│   │   │   ├── [id]/
│   │   │   │   └── regenerate-quiz/
│   │   │   └── route.ts
│   │   ├── flashcards/           # Flashcard features
│   │   │   └── verify-answer/
│   │   ├── quiz/                 # Quiz analytics
│   │   ├── analytics/            # Study analytics
│   │   ├── error-book/           # Wrong answers tracking
│   │   ├── profile/              # User profile management
│   │   ├── notes/                # Notes editing
│   │   ├── qa/                   # Q&A chatbot
│   │   └── admin/                # Admin endpoints
│   ├── dashboard/                # User dashboard
│   ├── documents/[id]/           # Document detail page
│   ├── login/                    # Login page
│   ├── register/                 # Registration page
│   ├── forgot-password/          # Password recovery
│   ├── profile/                  # User profile page
│   ├── analytics/                # Analytics dashboard
│   ├── error-book/               # Error book page
│   ├── admin/                    # Admin dashboard
│   ├── providers/                 # React context
│   │   └── AuthProvider.tsx
│   └── components/ui/             # UI components
├── lib/                          # Utility functions
│   ├── db.ts                     # MongoDB connection
│   ├── auth.ts                   # JWT authentication
│   ├── s3.ts                     # AWS S3 operations
│   ├── ses.ts                    # AWS SES email service
│   ├── email.ts                  # Email utilities
│   ├── ai.ts                     # Google Gemini integration
│   └── rate-limit.ts             # Rate limiting
├── models/                       # Mongoose schemas
│   ├── User.ts
│   ├── Document.ts
│   ├── Summary.ts
│   ├── Note.ts
│   ├── Flashcard.ts
│   ├── FlashcardPerformance.ts
│   ├── QuizQuestion.ts
│   ├── QuizPerformance.ts
│   ├── WrongAnswer.ts
│   ├── StudySession.ts
│   └── EmailVerification.ts
├── .env.local                    # Environment variables
├── env-template.txt              # Environment template
├── next.config.js
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration with email verification
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password recovery
- OAuth endpoints for Google/GitHub

### Documents & Content
- `GET/POST /api/documents` - Manage documents
- `POST /api/flashcards/verify-answer` - AI answer verification
- `POST /api/analytics/quiz` - Submit quiz answers
- `PATCH /api/notes/[id]` - Update notes
- `POST /api/qa` - Q&A chatbot

### User Management
- `GET /api/profile/stats` - User statistics
- `PUT /api/profile/update-*` - Update profile information
- `DELETE /api/profile/delete-account` - Account deletion

## 🔒 Security Features
- Password hashing with bcryptjs
- JWT tokens in httpOnly cookies
- File upload validation (type, size)
- Rate limiting on authentication
- Email verification for critical actions
- Role-based access control

## ⚙️ Configuration

### Required Environment Variables
| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Database connection |
| `GEMINI_API_KEY` | AI content generation |
| `AWS_*` | File storage and email |
| `JWT_SECRET` | Authentication security |
| `ADMIN_EMAIL` | Admin access |

## 🐛 Troubleshooting

### Common Issues
- **MongoDB Connection**: Check `.env.local` and IP whitelist
- **File Upload**: Verify AWS S3 credentials and permissions
- **Email Sending**: Confirm SES configuration and verified email
- **OAuth**: Ensure callback URLs match exactly
- **AI Features**: Validate Gemini API key and quota

### Quick Fixes
- Restart dev server after environment changes
- Clear browser cache and cookies
- Check file size (<10MB) and type (PDF/DOCX)
- Verify all environment variables are set

## 🚢 Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Production Checklist
- Set all required environment variables
- Configure custom domain (if needed)
- Update OAuth callback URLs
- Enable HTTPS
- Monitor API rate limits

## 📝 Development
```bash
npm run dev    # Development server
npm run build  # Production build
npm run lint   # Code linting
```

---

**Built with ❤️ using Next.js, MongoDB, Google Gemini AI, and AWS**