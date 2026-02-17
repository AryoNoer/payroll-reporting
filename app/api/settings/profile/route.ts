// app/api/settings/profile/route.ts
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const currentUser = await requireAuth();
        const user = await prisma.user.findUnique({
            where: { id: currentUser.id },
            select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
        return NextResponse.json(user);
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
}

export async function PUT(request: Request) {
    try {
        const currentUser = await requireAuth();
        const { name, email } = await request.json();

        if (!name || !email) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
        }

        // Check if email is already used by another user
        if (email !== currentUser.email) {
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
                return NextResponse.json({ error: 'Email is already in use' }, { status: 409 });
            }
        }

        const updated = await prisma.user.update({
            where: { id: currentUser.id },
            data: { name, email },
            select: { id: true, name: true, email: true, role: true },
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}
