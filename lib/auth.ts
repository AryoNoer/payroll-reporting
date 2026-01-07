// lib/auth.ts
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function requireAuth() {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if session exists
    if (!session?.user?.email) {
      console.error("[requireAuth] No session or email found");
      throw new Error("Unauthorized - No session");
    }

    console.log(`[requireAuth] Session found for: ${session.user.email}`);

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { 
        email: session.user.email 
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      }
    });

    if (!user) {
      console.error(`[requireAuth] User not found in DB: ${session.user.email}`);
      throw new Error("Unauthorized - User not found");
    }

    console.log(`[requireAuth] User authenticated: ${user.email} (${user.id})`);
    
    return user;

  } catch (error) {
    console.error("[requireAuth] Error:", error);
    throw new Error("Unauthorized");
  }
}

export { authOptions };