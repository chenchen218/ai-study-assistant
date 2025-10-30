#!/bin/bash

echo "🚀 AI Study Assistant - Setup Script"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm version: $(npm --version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "⚠️  Please edit .env.local and add your configuration values:"
    echo "   - MONGODB_URI"
    echo "   - OPENAI_API_KEY"
    echo "   - AWS credentials"
    echo "   - JWT_SECRET"
    echo ""
else
    echo "✅ .env.local already exists"
    echo ""
fi

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your configuration"
echo "2. Make sure MongoDB is running"
echo "3. Set up AWS S3 bucket"
echo "4. Run 'npm run dev' to start the development server"

