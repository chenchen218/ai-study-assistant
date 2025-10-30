# AI Study Assistant

An intelligent study assistant platform that helps students manage study materials, generate summaries, notes, flashcards, and practice quizzes using AI.

## Features

- **User Authentication**: Secure registration and login system
- **Document Upload**: Support for PDF and DOCX files
- **AI-Powered Summarization**: Automatic generation of concise summaries
- **Study Notes**: Detailed notes with key concepts highlighted
- **Flashcards**: Interactive flashcards for active recall
- **Practice Quizzes**: Multiple-choice questions with explanations
- **Q&A Chatbot**: Ask questions and get contextual answers
- **Admin Dashboard**: Monitor system usage and performance

## Technology Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MongoDB with Mongoose
- **AI**: OpenAI GPT-4
- **File Storage**: AWS S3
- **Authentication**: JWT with httpOnly cookies

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- MongoDB instance (local or MongoDB Atlas)
- OpenAI API key
- AWS account with S3 bucket

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd ai-study-assistant
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your configuration:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/ai-study-assistant
# Or MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/ai-study-assistant

# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=ai-study-assistant-documents

# JWT Secret for authentication
JWT_SECRET=your_jwt_secret_key_here_change_in_production

# Next.js
NEXTAUTH_URL=http://localhost:3000

# Admin Configuration
ADMIN_EMAIL=admin@example.com
```

4. Create an S3 bucket:

   - Go to AWS S3 console
   - Create a new bucket named `ai-study-assistant-documents` (or update the name in `.env.local`)
   - Configure CORS if needed
   - Set up IAM user with S3 permissions

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Upload Document**: Upload a PDF or DOCX file from your dashboard
3. **View Content**: Once processing completes, view:
   - Summary
   - Study Notes
   - Flashcards (interactive practice)
   - Quiz Questions (with immediate feedback)
   - Q&A (ask questions about the document)
4. **Admin Access**: If your email matches ADMIN_EMAIL, you'll have admin access to view system statistics

## Deployment

### Vercel (Frontend + API)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Database (MongoDB Atlas)

1. Create a MongoDB Atlas account
2. Create a cluster
3. Get connection string and update MONGODB_URI

### AWS S3

1. Create S3 bucket
2. Configure CORS policy
3. Set up IAM user with S3 access
4. Add credentials to environment variables

## Project Structure

```
ai-study-assistant/
├── app/
│   ├── api/              # API routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── documents/    # Document management
│   │   ├── qa/           # Q&A endpoint
│   │   └── admin/        # Admin endpoints
│   ├── dashboard/        # User dashboard
│   ├── documents/        # Document detail pages
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   ├── admin/            # Admin dashboard
│   └── providers/        # Context providers
├── lib/                  # Utility functions
│   ├── db.ts            # Database connection
│   ├── auth.ts          # Authentication utilities
│   ├── s3.ts            # S3 operations
│   └── ai.ts            # OpenAI integration
├── models/               # Mongoose models
└── package.json
```

## Security Notes

- Passwords are hashed using bcryptjs
- JWT tokens stored in httpOnly cookies
- File uploads validated and stored securely in S3
- Admin routes protected with role-based access control

## Performance Considerations

- Text extraction limited to 10,000 characters for AI processing
- AI generation happens asynchronously after upload
- Database queries optimized with proper indexing
- S3 signed URLs expire after 7 days

## Future Enhancements

- Advanced personalization based on learning patterns
- LMS integration (Canvas, Blackboard)
- Real-time group collaboration
- Export study materials to various formats
- Spaced repetition algorithm for flashcards
- Mobile app (React Native)

## License

MIT

## Support

For issues and questions, please open an issue on the repository.
