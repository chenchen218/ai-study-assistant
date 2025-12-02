# AI Study Assistant

An intelligent study assistant platform that helps students manage study materials, generate summaries, notes, flashcards, and practice quizzes using AI.

## ✨ Features

- **User Authentication**: Secure registration and login system with JWT tokens
- **Document Upload**: Support for PDF and DOCX files
- **AI-Powered Summarization**: Automatic generation of concise summaries
- **Study Notes**: Detailed notes with key concepts highlighted
- **Flashcards**: Interactive flashcards for active recall (10 per document)
- **Practice Quizzes**: Multiple-choice questions with explanations (5 per document)
- **Q&A Chatbot**: Ask questions and get contextual answers about documents
- **Study Analytics**: Track study time, performance metrics, and learning progress
  - Study time tracking (automatic)
  - Quiz accuracy tracking
  - Flashcard mastery tracking
  - Study streaks
  - Weekly/monthly reports with charts
- **Admin Dashboard**: Monitor system usage and performance

## 🛠 Technology Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Mongoose
- **AI**: Google Gemini 2.5 Flash Preview
- **File Storage**: AWS S3
- **Authentication**: JWT with httpOnly cookies
- **Type Safety**: TypeScript

## 📋 Prerequisites

- Node.js 18+ and npm
- MongoDB instance (local or MongoDB Atlas recommended)
- Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))
- AWS account with S3 bucket (for file uploads)

## 🚀 Quick Start

> 👥 **For Team Members**: See [TEAM_SETUP.md](./TEAM_SETUP.md) for a detailed step-by-step setup guide.

### 1. Clone and Install

```bash
git clone <repository-url>
cd ai-study-assistant
npm install
```

### 2. Set Up MongoDB Atlas (Recommended)

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

### 3. Set Up Google OAuth (Optional - for Google Sign-In)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Application type: "Web application"
   - Authorized JavaScript origins: `http://localhost:3000` (for dev)
   - Authorized redirect URIs: `http://localhost:3000` (for dev)
   - Copy the Client ID
5. Add to `.env.local` (see below)

**Note:** For production, update authorized origins/redirects to your production URL.

### 4. Set Up Email Service (Optional but Recommended)

For email verification, you'll need a Resend account:

1. Sign up at [Resend](https://resend.com) (free tier available)
2. Create an API key in the dashboard
3. Add your domain or use the default `onboarding@resend.dev` for testing
4. Add the API key to `.env.local` (see below)

**Note:** Without `RESEND_API_KEY`, email verification is disabled. Users can still register, but verification links will be logged to the console in development.

### 5. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Database
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/ai-study-assistant

# Google Gemini API (required for AI features)
# Get your API key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# AWS S3 Configuration (required for file uploads)
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=ai-study-assistant-documents

# JWT Secret (change this to a random string!)
JWT_SECRET=your-random-secret-key-change-in-production

# Admin Configuration
ADMIN_EMAIL=admin@example.com

# Email Domain Restrictions (Optional)
# Comma-separated list of allowed email domains for registration
# Example: ALLOWED_EMAIL_DOMAINS=university.edu,company.com
# Leave empty or unset to allow any email domain
ALLOWED_EMAIL_DOMAINS=

# Email Validation (Optional)
# MX record validation is ENABLED by default to block fake/random emails
# Set to "false" to disable (not recommended - allows fake emails)
# Adds ~100-500ms delay per registration but blocks invalid domains
ENABLE_MX_VALIDATION=true

# Email Verification (Optional)
# Set to "false" to disable email verification requirement
# When disabled, users can register and login immediately without verifying email
# Default: true (email verification required)
ENABLE_EMAIL_VERIFICATION=true

# Email Verification (Optional but Recommended for Production)
# Get your API key from: https://resend.com/api-keys
RESEND_API_KEY=re_your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
# Public app URL for verification links (required for email verification)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google OAuth (Optional - for Google Sign-In)
# Get your client ID from: https://console.cloud.google.com/apis/credentials
# Create OAuth 2.0 Client ID, set authorized JavaScript origins and redirect URIs
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_ID=your_google_client_id_here
```

### 6. Set Up AWS S3 (For File Uploads)

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

### 7. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Guide

### First Time Setup

1. **Register**: Create a new account at `/register`
2. **Verify Email**: Check your inbox and click the verification link (required before login)
3. **Login**: Sign in with your verified credentials
4. **Upload**: Upload a PDF or DOCX file from the dashboard
5. **Wait**: Processing happens asynchronously (check status indicator)
6. **Explore**: Once complete, view summaries, notes, flashcards, and quizzes

**Note:** If you don't receive a verification email:

- Check spam folder
- Click "Resend Verification Email" on the login page
- In development without `RESEND_API_KEY`, check the console for the verification link

### Features

- **Dashboard**: View all your uploaded documents
- **Document Detail**: Click any document to view:
  - Summary (AI-generated overview)
  - Study Notes (Detailed notes)
  - Flashcards (Interactive practice)
  - Quiz (Multiple-choice questions with scoring)
  - Q&A (Ask questions about the document)
- **Admin Dashboard**: Access system statistics (if admin user)

## 🗂 Project Structure

```
ai-study-assistant/
├── app/
│   ├── api/                  # API routes
│   │   ├── auth/             # Authentication endpoints
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── logout/
│   │   │   └── me/
│   │   ├── documents/         # Document management
│   │   │   └── [id]/         # Document details
│   │   ├── qa/               # Q&A endpoint
│   │   └── admin/            # Admin endpoints
│   │       └── stats/
│   ├── dashboard/            # User dashboard
│   ├── documents/            # Document detail pages
│   │   └── [id]/
│   ├── login/                # Login page
│   ├── register/             # Registration page
│   ├── admin/                # Admin dashboard
│   ├── providers/            # React context providers
│   │   └── AuthProvider.tsx
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page
├── lib/                      # Utility functions
│   ├── db.ts                # MongoDB connection
│   ├── auth.ts              # JWT authentication
│   ├── s3.ts                # AWS S3 operations
│   └── ai.ts                # OpenAI integration
├── models/                   # Mongoose schemas
│   ├── User.ts
│   ├── Document.ts
│   ├── Summary.ts
│   ├── Note.ts
│   ├── Flashcard.ts
│   └── QuizQuestion.ts
├── .env.local                # Environment variables (not in git)
├── next.config.js
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Documents

- `GET /api/documents` - Get all user documents
- `POST /api/documents` - Upload new document
- `GET /api/documents/[id]` - Get document details with AI content

### Q&A

- `POST /api/qa` - Ask questions about a document

### Admin

- `GET /api/admin/stats` - Get system statistics (admin only)

## 🔒 Security

- ✅ Passwords hashed with bcryptjs (10 rounds)
- ✅ JWT tokens stored in httpOnly cookies
- ✅ File uploads validated (PDF/DOCX only)
- ✅ Files stored securely in S3
- ✅ Role-based access control (user/admin)
- ✅ Environment variables for sensitive data
- ✅ Optional email domain whitelist for registration
- ✅ Email validation (format, disposable email blocking, optional MX record check)
- ✅ Email verification (prevents fake accounts, recommended for production)

## ⚙️ Configuration

### Environment Variables

| Variable                       | Required    | Description                                                       |
| ------------------------------ | ----------- | ----------------------------------------------------------------- |
| `MONGODB_URI`                  | ✅ Yes      | MongoDB connection string                                         |
| `GEMINI_API_KEY`               | ✅ Yes      | Google Gemini API key for AI features                             |
| `AWS_ACCESS_KEY_ID`            | ✅ Yes      | AWS access key for S3                                             |
| `AWS_SECRET_ACCESS_KEY`        | ✅ Yes      | AWS secret key for S3                                             |
| `AWS_REGION`                   | ✅ Yes      | AWS region (e.g., us-east-1)                                      |
| `AWS_S3_BUCKET_NAME`           | ✅ Yes      | S3 bucket name                                                    |
| `JWT_SECRET`                   | ✅ Yes      | Secret for JWT token signing                                      |
| `ADMIN_EMAIL`                  | ⚠️ Optional | Email address for admin access                                    |
| `ALLOWED_EMAIL_DOMAINS`        | ⚠️ Optional | Comma-separated allowed email domains                             |
| `ENABLE_MX_VALIDATION`         | ⚠️ Optional | Enable MX validation (default: true, set "false" to disable)      |
| `ENABLE_EMAIL_VERIFICATION`    | ⚠️ Optional | Enable email verification (default: true, set "false" to disable) |
| `RESEND_API_KEY`               | ⚠️ Optional | Resend API key for email verification                             |
| `RESEND_FROM_EMAIL`            | ⚠️ Optional | Sender email for verification emails                              |
| `NEXT_PUBLIC_APP_URL`          | ⚠️ Optional | Public app URL for verification links                             |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | ⚠️ Optional | Google OAuth client ID for frontend (Google Sign-In)              |
| `GOOGLE_CLIENT_ID`             | ⚠️ Optional | Google OAuth client ID for backend (token verification)           |

### MongoDB Collections

The application uses the following collections:

- **users**: User accounts and authentication
- **documents**: Document metadata and file references
- **summaries**: AI-generated summaries
- **notes**: AI-generated study notes
- **flashcards**: AI-generated flashcards
- **quizquestions**: AI-generated quiz questions

## 🐛 Troubleshooting

### Common Issues

#### MongoDB Connection Error

```
Error: Please define the MONGODB_URI environment variable
```

**Solution**:

- Check `.env.local` exists and contains `MONGODB_URI`
- Verify MongoDB Atlas IP whitelist includes your IP
- Ensure database user has correct permissions
- Restart the dev server after changing `.env.local`

#### Document Upload Fails

**Solution**:

- Verify AWS S3 credentials are correct
- Check S3 bucket exists and IAM user has permissions
- Ensure bucket name matches `AWS_S3_BUCKET_NAME` in `.env.local`

#### AI Features Not Working

**Solution**:

- Verify `GEMINI_API_KEY` is set correctly
- Check Google AI Studio account has quota/credits
- Review API rate limits

#### "Loading..." Screen Stuck

**Solution**:

- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Check browser console for errors
- Verify MongoDB connection is working
- Check `/api/auth/me` endpoint returns 401 or 200

#### Build Errors

**Solution**:

- Delete `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Restart dev server

## 📊 Current Status

### ✅ Working Features

- User registration and authentication
- MongoDB connection and data storage
- Dashboard UI and navigation
- Document listing
- Authentication flow

### ⚠️ Requires Configuration

- **File Uploads**: Needs AWS S3 credentials
- **AI Features**: Needs Google Gemini API key
  - Summaries
  - Study Notes
  - Flashcards
  - Quiz Questions
  - Q&A Chatbot

## 🚢 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production

Make sure to set all environment variables in your hosting platform:

- MongoDB Atlas connection string
- Google Gemini API key
- AWS S3 credentials
- Strong JWT secret
- Admin email

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

## 📈 Performance Notes

- Text extraction limited to 10,000 characters to avoid token limits
- AI processing happens asynchronously (non-blocking uploads)
- S3 signed URLs expire after 7 days
- Database queries use proper indexing
- MongoDB connection uses caching for serverless environments

## 🎯 Future Enhancements

- [ ] Advanced personalization based on learning patterns
- [ ] LMS integration (Canvas, Blackboard)
- [ ] Real-time group collaboration
- [ ] Export study materials to various formats
- [ ] Spaced repetition algorithm for flashcards
- [ ] Mobile app (React Native)
- [ ] Rate limiting for API routes
- [ ] Email notifications for processing completion
- [ ] File size limits and validation
- [ ] Document cleanup for old files

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📞 Support

For issues and questions, please open an issue on the repository.

---

**Built with ❤️ using Next.js, MongoDB, OpenAI, and AWS**
