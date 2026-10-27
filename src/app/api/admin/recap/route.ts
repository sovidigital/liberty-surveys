import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sendNightlyRecap, getRecapPreview } from '@/lib/recap-sender';

export async function POST(request: NextRequest) {
  try {
    const isScheduledJob = request.headers.get('x-scheduled-job') === 'true';
    const schedulerSecret = request.headers.get('x-scheduler-secret');
    const expectedSecret = process.env.SCHEDULER_SECRET;
    
    if (isScheduledJob) {
      if (expectedSecret && schedulerSecret !== expectedSecret) {
        return NextResponse.json(
          { error: 'Invalid scheduler secret' },
          { status: 401 }
        );
      }
    } else {
      const session = await getSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    const body = await request.json().catch(() => ({}));
    const minVotes = body.minVotes ? parseInt(body.minVotes, 10) : undefined;
    
    console.log(`[API] Nightly recap triggered (scheduled: ${isScheduledJob})`);
    
    const result = await sendNightlyRecap({ minVotes });
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        recapId: result.recapId,
        skipped: result.skipped || false,
        skipReason: result.skipReason,
        subscriberCount: result.subscriberCount,
      });
    } else {
      return NextResponse.json({
        success: false,
        recapId: result.recapId,
        error: result.error,
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[API] Recap error:', error);
    return NextResponse.json(
      { error: 'Recap send failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const preview = await getRecapPreview();
  
  if (!preview) {
    return NextResponse.json({
      message: 'No active poll found for recap preview',
      preview: null,
    });
  }
  
  return NextResponse.json({
    message: 'Recap preview for active poll',
    preview,
  });
}
