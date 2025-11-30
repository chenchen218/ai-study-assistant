# AI Study Assistant

An intelligent study assistant platform that helps students manage study materials, generate summaries, notes, flashcards, and practice quizzes using AI-powered content generation.

## ✨ Features

### 🔐 Authentication & User Management

- **Multi-Provider Authentication**:
  - Email/Password registration with email verification
  - Google OAuth login
  - GitHub OAuth login
  - Secure JWT-based session management

- **User Profile Management**:
  - Update username
  - Change email address (with verification)
  - Change password (for local accounts)
  - View account statistics (documents, study time, quizzes, streaks)
  - Delete account (with double confirmation)

- **Password Recovery**:
  - Forgot password functionality
  - Email-based password reset with verification codes

### 📄 Document Management

- **File Upload**:
  - Support for PDF and DOCX files
  - File size limit: 10MB maximum
  - Automatic text extraction
  - Secure storage in AWS S3
  - Real-time processing status tracking

- **Document Features**:
  - View all uploaded documents
  - Search and filter documents by status
  - Delete documents and associated content
  - Document status tracking (processing, completed, failed)

### 🤖 AI-Powered Content Generation

- **Summary**: Automatic generation of concise document summaries
- **Study Notes**: Detailed notes with markdown formatting, editable by users
- **Flashcards**: Interactive flashcards (10 per document)
  - User input answer verification with AI semantic comparison
  - Mastery tracking (mark as "I know this" or "Need review")
  - Export to PDF or CSV
- **Practice Quizzes**: Multiple-choice questions (5 per document)
  - Quiz refresh functionality to generate new questions
  - Duplicate prevention (avoids generating similar questions)
  - Score tracking and explanations
  - Wrong answers saved to Error Book
- **Q&A Chatbot**: Ask questions and get contextual answers about documents

### 📊 Analytics & Tracking

- **Study Analytics Dashboard**:
  - Total study time tracking
  - Quiz performance statistics (total quizzes, average score)
  - Flashcard mastery tracking (total reviewed, mastered count)
  - Daily study time charts (last 7 days)
  - Study session tracking

- **Error Book**:
  - View all wrong quiz answers grouped by document
  - Track incorrect answers with explanations
  - Delete individual wrong answers
  - Works even if original document is deleted

### 👤 User Profile

- **Account Information**:
  - Display user name, account type, member since date, role
  - Account statistics (documents, study time, quizzes, day streak)

- **Account Management**:
  - Update name
  - Change email (requires new email verification)
  - Change password (local accounts only)
  - Delete account (double confirmation, no password required)

### 🛡️ Admin Features

- **Admin Dashboard**:
  - System-wide statistics
  - User count and document count
  - System usage metrics
  - Access restricted to admin users

## 🛠 Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Next.js API Routes (Serverless)
- **Database**: MongoDB with Mongoose ODM
- **AI**: Google Gemini 2.5 Flash Preview
- **File Storage**: AWS S3
- **Email Service**: AWS SES (Simple Email Service) with domain verification
- **Authentication**: JWT with httpOnly cookies, OAuth 2.0 (Google, GitHub)
- **Password Hashing**: bcryptjs (10 rounds)
- **Type Safety**: TypeScript
- **PDF Processing**: pdf-parse
- **DOCX Processing**: mammoth
- **PDF Export**: jsPDF, html2canvas

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB instance (MongoDB Atlas recommended)
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))
- AWS account with:
  - S3 bucket (for file storage)
  - SES configured (for email notifications)
  - IAM user with appropriate permissions
- (Optional) Google OAuth credentials
- (Optional) GitHub OAuth credentials

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd ai-study-assistant
npm install
```

### 2. Set Up MongoDB Atlas

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Create a new cluster (choose FREE tier)
3. Create a database user:
   - Go to "Database Access" → "Add New Database User"
   - Choose "Password" authentication
   - Save username and password
4. Whitelist your IP:
   - Go to "Network Access" → "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
5. Get connection string:
   - Go to "Database" → "Connect" → "Connect your application"
   - Copy the connection string

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/ai-study-assistant

# Google Gemini API (required for AI features)
GEMINI_API_KEY=your_gemini_api_key_here

# AWS S3 Configuration (required for file uploads)
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=ai-study-assistant-documents

# AWS SES Configuration (for email notifications)
AWS_SES_FROM_EMAIL=mail@yourdomain.com

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-generated-jwt-secret-here

# Admin Configuration
ADMIN_EMAIL=admin@example.com

# OAuth (Optional - for Google/GitHub login)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Base URL (Optional - for OAuth callbacks, auto-detected in production)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### 4. Set Up AWS Services

#### AWS S3 (File Storage)

1. Create an S3 bucket in AWS Console
2. Create an IAM user with S3 permissions:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::your-bucket-name/*"
       }
     ]
   }
   ```
3. Generate access keys and add to `.env.local`

#### AWS SES (Email Service)

1. Verify your email address or domain in AWS SES Console
2. Request production access (if needed) to send to any email
3. Ensure IAM user has `AmazonSESFullAccess` policy
4. Set `AWS_SES_FROM_EMAIL` to your verified email (e.g., `mail@yourdomain.com`)

### 5. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Guide

### First Time Setup

1. **Register**: 
   - Go to `/register`
   - Enter name, email, and password (minimum 8 characters)
   - Verify email with 6-digit code sent to your email
   - Complete registration

2. **Login**: 
   - Use email/password, or
   - Sign in with Google/GitHub (if configured)

3. **Upload Document**: 
   - Upload a PDF or DOCX file (max 10MB) from the dashboard
   - Wait for processing (happens asynchronously)
   - Check status indicator

4. **Explore**: 
   - Once processing is complete, click the document to view:
     - **Summary**: AI-generated overview
     - **Notes**: Detailed study notes (editable)
     - **Flashcards**: Interactive practice with answer verification
     - **Quiz**: 5 multiple-choice questions (refreshable)
     - **Q&A**: Ask questions about the document

### Key Features

#### Flashcards

- **Interactive Practice**: Flip cards to reveal answers
- **Answer Verification**: Type your answer and get AI-powered feedback
- **Mastery Tracking**: Mark cards as "I know this" or "Need review"
- **Export**: Download flashcards as PDF or CSV

#### Quizzes

- **Practice Mode**: Answer 5 multiple-choice questions
- **Instant Feedback**: See correct answers and explanations
- **Score Tracking**: Track your performance
- **Refresh Quiz**: Generate new questions (avoids duplicates)
- **Error Book**: Wrong answers automatically saved for review

#### Error Book

- View all wrong quiz answers
- Grouped by document
- Delete individual wrong answers
- Works even if original document is deleted

#### User Profile

- **View Statistics**: Documents, study time, quizzes, streaks
- **Update Information**: Name, email, password
- **Account Management**: Delete account with double confirmation

#### Analytics

- **Study Time**: Track total and daily study time
- **Quiz Performance**: View total quizzes and average scores
- **Flashcard Mastery**: Track reviewed and mastered flashcards
- **Visual Charts**: Daily study time visualization

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

- `POST /api/auth/register` - Register new user (requires email verification)
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `POST /api/auth/send-verification-code` - Send email verification code
- `POST /api/auth/verify-code` - Verify email code
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with code
- `GET /api/auth/oauth/google` - Initiate Google OAuth
- `GET /api/auth/oauth/google/callback` - Google OAuth callback
- `GET /api/auth/oauth/github` - Initiate GitHub OAuth
- `GET /api/auth/oauth/github/callback` - GitHub OAuth callback

### Documents

- `GET /api/documents` - Get all user documents
- `POST /api/documents` - Upload new document (max 10MB)
- `GET /api/documents/[id]` - Get document details with AI content
- `DELETE /api/documents/[id]` - Delete document and all associated content
- `POST /api/documents/[id]/regenerate-quiz` - Regenerate quiz questions

### Flashcards

- `POST /api/flashcards/verify-answer` - Verify user's flashcard answer with AI
- `POST /api/analytics/flashcards` - Update flashcard performance

### Quizzes

- `POST /api/analytics/quiz` - Submit quiz answers and track performance

### Notes

- `PATCH /api/notes/[id]` - Update note content

### Profile

- `GET /api/profile/stats` - Get user statistics
- `PUT /api/profile/update-name` - Update user name
- `PUT /api/profile/update-email` - Update email (requires verification)
- `PUT /api/profile/change-password` - Change password
- `DELETE /api/profile/delete-account` - Delete user account

### Analytics

- `GET /api/analytics` - Get comprehensive study analytics
- `POST /api/analytics/sessions` - Track study sessions

### Error Book

- `GET /api/error-book` - Get all wrong answers grouped by document
- `GET /api/error-book/[documentId]` - Get wrong answers for a document
- `DELETE /api/error-book/[documentId]` - Delete a wrong answer

### Q&A

- `POST /api/qa` - Ask questions about a document

### Admin

- `GET /api/admin/stats` - Get system statistics (admin only)

## 🔒 Security Features

- ✅ Passwords hashed with bcryptjs (10 rounds)
- ✅ JWT tokens stored in httpOnly cookies
- ✅ Secure cookie configuration (HTTPS in production)
- ✅ File uploads validated (PDF/DOCX only, 10MB limit)
- ✅ Files stored securely in S3 with private access
- ✅ Role-based access control (user/admin)
- ✅ Email verification for registration and email changes
- ✅ Rate limiting on authentication endpoints
- ✅ OAuth 2.0 secure authentication
- ✅ Environment variables for sensitive data
- ✅ CORS protection
- ✅ Input validation and sanitization

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` | ✅ Yes | MongoDB connection string |
| `GEMINI_API_KEY` | ✅ Yes | Google Gemini API key for AI features |
| `AWS_ACCESS_KEY_ID` | ✅ Yes | AWS access key for S3 and SES |
| `AWS_SECRET_ACCESS_KEY` | ✅ Yes | AWS secret key for S3 and SES |
| `AWS_REGION` | ✅ Yes | AWS region (e.g., us-east-1) |
| `AWS_S3_BUCKET_NAME` | ✅ Yes | S3 bucket name |
| `AWS_SES_FROM_EMAIL` | ✅ Yes | Verified email address for SES |
| `JWT_SECRET` | ✅ Yes | Secret for JWT token signing |
| `ADMIN_EMAIL` | ⚠️ Optional | Email address for admin access |
| `GOOGLE_CLIENT_ID` | ⚠️ Optional | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ⚠️ Optional | Google OAuth client secret |
| `GITHUB_CLIENT_ID` | ⚠️ Optional | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | ⚠️ Optional | GitHub OAuth client secret |
| `NEXT_PUBLIC_BASE_URL` | ⚠️ Optional | Base URL for OAuth callbacks (auto-detected) |

### MongoDB Collections

- **users**: User accounts and authentication
- **documents**: Document metadata and file references
- **summaries**: AI-generated summaries
- **notes**: AI-generated study notes (editable)
- **flashcards**: AI-generated flashcards
- **flashcardperformances**: Flashcard mastery tracking
- **quizquestions**: AI-generated quiz questions
- **quizperformances**: Quiz attempt tracking
- **wronganswers**: Incorrect quiz answers for review
- **studysessions**: Study session tracking
- **emailverifications**: Email verification codes

## 🐛 Troubleshooting

### Common Issues

#### MongoDB Connection Error

**Error**: `MongooseServerSelectionError` or connection timeout

**Solution**:
- Check `.env.local` exists and contains `MONGODB_URI`
- Verify MongoDB Atlas IP whitelist includes your IP (or allow from anywhere)
- Ensure database user has correct permissions
- Restart the dev server after changing `.env.local`

#### Document Upload Fails

**Error**: "Unauthorized" or upload fails

**Solution**:
- Verify AWS S3 credentials are correct
- Check S3 bucket exists and IAM user has permissions
- Ensure bucket name matches `AWS_S3_BUCKET_NAME` in `.env.local`
- Check file size is under 10MB
- Verify file type is PDF or DOCX

#### Email Not Sending

**Error**: "Failed to send email" or SES errors

**Solution**:
- Verify AWS SES environment variables are set
- Check email address is verified in AWS SES (for Sandbox mode)
- Ensure IAM user has `AmazonSESFullAccess` policy
- Request production access in SES if needed
- Check AWS region matches SES region

#### OAuth Login Fails

**Error**: `redirect_uri_mismatch`

**Solution**:
- Verify callback URL in Google/GitHub OAuth app matches exactly
- For production: `https://your-domain.com/api/auth/oauth/google/callback`
- For development: `http://localhost:3000/api/auth/oauth/google/callback`
- Wait a few minutes for OAuth configuration to propagate
- Clear browser cache and cookies

#### AI Features Not Working

**Error**: AI generation fails or returns empty

**Solution**:
- Verify `GEMINI_API_KEY` is set correctly
- Check Google AI Studio account has quota/credits
- Review API rate limits
- Check console logs for specific error messages

#### "Loading..." Screen Stuck

**Solution**:
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Check browser console for errors
- Verify MongoDB connection is working
- Check `/api/auth/me` endpoint returns 401 or 200
- Clear browser cookies

#### Build Errors

**Solution**:
- Delete `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run build`
- Restart dev server

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel dashboard
4. Configure custom domain (optional)
5. Deploy

### Environment Variables for Production

Make sure to set all environment variables in your hosting platform:

- MongoDB Atlas connection string
- Google Gemini API key
- AWS S3 credentials
- AWS SES configuration
- Strong JWT secret (generate with `openssl rand -base64 32`)
- Admin email
- OAuth credentials (if using)
- Base URL (for OAuth callbacks)

### Custom Domain Setup

1. Add domain in Vercel project settings
2. Configure DNS records in your domain provider
3. Update OAuth callback URLs in Google/GitHub apps
4. Update `NEXT_PUBLIC_BASE_URL` environment variable

## 📝 Development Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## 🔐 Security Best Practices

1. **Never commit `.env.local`** - It's in `.gitignore`
2. **Use strong JWT_SECRET** - Generate with: `openssl rand -base64 32`
3. **Limit S3 bucket permissions** - Only grant necessary permissions
4. **Rotate API keys regularly** - Especially in production
5. **Use HTTPS in production** - Configure SSL certificates
6. **Enable rate limiting** - Already implemented for auth endpoints
7. **Verify email addresses** - Prevents spam and ensures valid users
8. **Use httpOnly cookies** - Prevents XSS attacks
9. **Validate all inputs** - File types, sizes, and formats
10. **Keep dependencies updated** - Regularly update npm packages

## 📈 Performance Notes

- Text extraction limited to 10,000 characters to avoid token limits
- AI processing happens asynchronously (non-blocking uploads)
- S3 signed URLs expire after 7 days
- Database queries use proper indexing
- MongoDB connection uses caching for serverless environments
- File size limit: 10MB maximum
- Rate limiting on authentication endpoints
- Dynamic rendering for API routes using `export const dynamic = 'force-dynamic'`

## 🎯 Features Overview

### ✅ Implemented Features

- ✅ Multi-provider authentication (Email, Google, GitHub)
- ✅ Email verification system
- ✅ Password recovery
- ✅ User profile management
- ✅ Document upload and processing (PDF/DOCX, 10MB limit)
- ✅ AI-powered content generation (Summary, Notes, Flashcards, Quiz, Q&A)
- ✅ Interactive flashcards with answer verification
- ✅ Quiz system with refresh functionality
- ✅ Error Book for wrong answers
- ✅ Study analytics dashboard
- ✅ Admin dashboard
- ✅ Notes editing
- ✅ Flashcard/Notes export (PDF, CSV)
- ✅ Study session tracking
- ✅ Performance tracking (quiz scores, flashcard mastery)
- ✅ Account deletion with double confirmation
- ✅ Email notifications (AWS SES)

### 🔄 Recent Updates

- File size limit: 10MB maximum
- Quiz count: 5 questions per document
- Quiz refresh: Generate new questions (avoids duplicates)
- Flashcard answer verification: AI-powered semantic comparison
- Email verification: Required for registration
- OAuth login: Google and GitHub support
- User profile: Complete account management
- Error Book: Track and review wrong answers
- Analytics: Comprehensive study tracking

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please open an issue on the repository.

---

**Built with ❤️ using Next.js, MongoDB, Google Gemini AI, and AWS**
