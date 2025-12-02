import { NextRequest, NextResponse } from "next/server";

// add detailed comments explaining this code
/**
 * Logout Route Handler
 * 
 * This API route handles user logout by clearing the authentication cookie.
 * When a user logs out, the server responds by deleting the "token" cookie,
 * effectively ending the user's authenticated session.
 * 
 * The route responds to POST requests, which is a common practice for actions
 * that change server state, such as logging out.
 * 
 * @param request - The incoming NextRequest object
 * @returns A NextResponse indicating successful logout
 **/

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: "Logged out successfully" });
  response.cookies.delete("token");
  return response;
}
