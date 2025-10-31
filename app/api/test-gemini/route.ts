import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY is not set",
          apiKeyPresent: false,
        },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // First, list available models
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      const modelsData = await response.json();

      // Filter models that support generateContent
      const generateContentModels =
        modelsData.models?.filter((m: any) =>
          m.supportedGenerationMethods?.includes("generateContent")
        ) || [];

      const modelsToTry = [
        "models/gemini-2.5-flash-preview-05-20",
        "models/gemini-2.5-pro-preview-03-25",
        ...generateContentModels.map((m: any) => m.name),
      ];

      let workingModel: string | null = null;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent("Say hello");
          const response = await result.response;
          workingModel = modelName;
          break;
        } catch (err: any) {
          lastError = err;
          continue;
        }
      }

      if (workingModel) {
        return NextResponse.json({
          success: true,
          apiKeyPresent: true,
          workingModel: workingModel,
          availableModels: modelsData.models?.map((m: any) => m.name) || [],
          message: `Gemini API is working! Using model: ${workingModel}`,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            apiKeyPresent: true,
            error: "Could not find a working model",
            availableModels: modelsData.models?.map((m: any) => m.name) || [],
            lastError: lastError?.message,
            modelsToTry: modelsToTry,
          },
          { status: 500 }
        );
      }
    } catch (listError: any) {
      // If listing models fails, try direct test
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      const result = await model.generateContent("Say hello");
      const response = await result.response;
      return NextResponse.json({
        success: true,
        apiKeyPresent: true,
        response: response.text(),
        message: "Gemini API is working!",
      });
    }
  } catch (error: any) {
    console.error("Gemini API Test Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Unknown error",
        details: error?.toString(),
      },
      { status: 500 }
    );
  }
}
