# 👥 Team Setup Guide

This guide will help your teammates set up the AI Study Assistant project on their local machines with full functionality.

## 📋 Prerequisites

Before starting, make sure you have:

- **Node.js 18+** installed ([Download here](https://nodejs.org/))
- **Git** installed
- **A code editor** (VS Code recommended)

---

## 🚀 Step-by-Step Setup

### **Step 1: Clone the Repository**

```bash
git clone <repository-url>
cd ai-study-assistant
```

---

### **Step 2: Install Dependencies**

```bash
npm install
```

This will install all required packages including Next.js, React, MongoDB, and AI libraries.

---

### **Step 3: Set Up Environment Variables**

1. **Copy the example environment file:**

   ```bash
   cp .env.example .env.local
   ```

2. **Open `.env.local` and fill in the values:**

#### **A. MongoDB Database (Already Set Up - Shared)**

```env
MONGODB_URI=mongodb+srv://dawsonlee0512_db_user:ekvqo1CQO5yrIONf@cluster0.u7cvnl3.mongodb.net/ai-study-assistant
```

✅ **Already configured** - MongoDB Atlas is set to allow all IPs, so this will work for everyone.

#### **B. Google Gemini API Key (Each Person Needs Their Own)**

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy your API key
5. Add to `.env.local`:
   ```env
   GEMINI_API_KEY=AIzaSy...your_key_here
   ```

> ⚠️ **Important**: Each teammate needs their own Gemini API key. Free tier includes 60 requests/minute.

#### **C. AWS S3 (Shared Credentials - OR Each Person Sets Up Their Own)**

**Option 1: Use Shared S3 Credentials (Recommended for Development)**

- Ask your team lead for the shared AWS credentials
- Add them to `.env.local`:
  ```env
  AWS_ACCESS_KEY_ID=AKIA...
  AWS_SECRET_ACCESS_KEY=...
  AWS_REGION=us-east-1
  AWS_S3_BUCKET_NAME=ai-study-buddy-5500
  ```

**Option 2: Set Up Your Own S3 Bucket**

- Follow the [AWS S3 Setup Guide](../README.md#4-set-up-aws-s3-for-file-uploads)
- Create your own bucket and IAM user
- Add your credentials to `.env.local`

#### **D. JWT Secret (Can Share for Development)**

```env
JWT_SECRET=change-this-to-a-random-secret-key-in-production
```

- For development, you can use the same secret as the team
- For production, generate a unique secret: `openssl rand -base64 32`

#### **E. Admin Email (Set Your Email)**

```env
ADMIN_EMAIL=your-email@example.com
```

- Set this to your email if you want admin access
- Or leave as `admin@example.com` if you don't need admin features

---

### **Step 4: Verify Setup**

1. **Test the Gemini API connection:**

   ```bash
   # Start the dev server
   npm run dev
   ```

   Then visit: `http://localhost:3000/api/test-gemini`

   - Should show: `{"success": true, ...}`

2. **Check if MongoDB is accessible:**
   - The app will connect automatically when you try to register/login
   - If you see connection errors, check MongoDB Atlas Network Access

---

### **Step 5: Run the Application**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ✅ What Should Work

Once set up correctly, you should be able to:

1. **Register/Login** - Create an account and sign in
2. **Upload Documents** - Upload PDF or DOCX files
3. **View AI-Generated Content**:
   - Summaries
   - Study Notes
   - Flashcards (10 per document)
   - Quiz Questions (5 per document)
4. **Ask Questions** - Use the Q&A feature to ask about documents
5. **Delete Documents** - Remove uploaded files

---

## 🔍 Troubleshooting

### **"Failed to connect to MongoDB"**

- **Solution**: MongoDB Atlas Network Access is already set to allow all IPs, but if you still have issues:
  - Check your internet connection
  - Verify the MongoDB URI in `.env.local` is correct
  - Make sure MongoDB Atlas cluster is running

### **Documents Show "Failed" Status**

- **Solution**: Check your `GEMINI_API_KEY`:
  - Visit `http://localhost:3000/api/test-gemini`
  - Should show success message
  - If error, verify your API key is correct

### **File Upload Fails**

- **Solution**: Check AWS S3 credentials:
  - Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
  - Check `AWS_S3_BUCKET_NAME` matches the actual bucket name
  - Ensure IAM user has S3 permissions

### **"Cannot find module" Errors**

- **Solution**: Reinstall dependencies:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

### **Port 3000 Already in Use**

- **Solution**: The app is configured to use port 3000. If it's busy:

  ```bash
  # Kill process on port 3000
  lsof -ti:3000 | xargs kill -9

  # Or use a different port temporarily
  npm run dev -- -p 3001
  ```

---

## 📝 Quick Reference

### **Shared Resources (Already Set Up)**

- ✅ MongoDB Atlas Database - `cluster0.u7cvnl3.mongodb.net`
- ✅ Network Access - Allowed from anywhere
- ✅ S3 Bucket - `ai-study-buddy-5500` (if using shared credentials)

### **Individual Setup Required**

- 🔑 Google Gemini API Key - Each person needs their own
- 💻 Local development environment (Node.js, Git)
- 📁 `.env.local` file with their own credentials

---

## 🎯 Team Collaboration Tips

1. **Never commit `.env.local`** - It's in `.gitignore`
2. **Share credentials securely** - Use team Slack/Discord or password manager
3. **Use the same MongoDB** - Already shared, so you'll see each other's test data
4. **Use shared S3 bucket** - If using shared credentials, you'll share uploaded files
5. **Test frequently** - Make sure all features work after pulling latest changes

---

## 📞 Getting Help

If you encounter issues:

1. Check this guide first
2. Check the main [README.md](./README.md) for detailed documentation
3. Test the API endpoints: `/api/test-gemini`
4. Check server terminal for error messages (not browser console!)
5. Ask the team lead or check server logs

---

## 🚀 You're Ready!

Once you've completed all steps, you should have a fully functional AI Study Assistant running locally. Happy coding! 🎉
