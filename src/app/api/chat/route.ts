import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateChatResponse, ChatMessage } from '@/services/ai/chat';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (user.user_metadata?.role !== 'patient') {
      return NextResponse.json({ success: false, error: 'Forbidden: Only patients can access this assistant' }, { status: 403 });
    }

    const patientId = user.id;

    // Validate request body
    const body = await req.json();
    if (!body || !Array.isArray(body.messages)) {
      return NextResponse.json({ success: false, error: 'Invalid request: messages array is required' }, { status: 400 });
    }

    const messages: ChatMessage[] = body.messages;

    // Bounded limits
    if (messages.length > 50) {
      return NextResponse.json({ success: false, error: 'Conversation history too long' }, { status: 400 });
    }
    
    // Check message sizes to prevent simple DOS
    const totalLength = messages.reduce((acc, m) => acc + (m.content?.length || 0), 0);
    if (totalLength > 50000) {
      return NextResponse.json({ success: false, error: 'Payload too large' }, { status: 400 });
    }

    // Pass to Engine
    const response = await generateChatResponse(messages, patientId);

    if (!response.success) {
      // Return 200 with error payload, rather than 500, to fail gracefully
      return NextResponse.json(response);
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[API_CHAT_ERROR]', error);
    // Graceful fallback for unexpected failure
    return NextResponse.json({ 
      success: false, 
      error: 'An unexpected error occurred. Please try again.',
      provider: 'none'
    });
  }
}
