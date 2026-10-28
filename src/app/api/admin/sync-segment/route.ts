import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { fetchSegmentMembers, identifySubscriber, CIOSegmentMember } from '@/lib/customerio';
import { generateId } from '@/lib/ulid';

interface SyncResult {
  totalMembers: number;
  reactivated: number;
  inserted: number;
  updated: number;
  durationMs: number;
}

/**
 * Sync CIO segment members to DSQL.
 * 
 * This endpoint handles the heavy work of:
 * 1. Fetching all segment members from Customer.io (with parallel attribute fetching)
 * 2. Upserting them into DSQL with batched queries
 * 
 * Call this:
 * - Before enabling the daily broadcast schedule
 * - As a periodic sync job (e.g., hourly) to catch any drift
 * - Manually after bulk CIO imports
 * 
 * The webhook handles incremental updates (new subscriptions/unsubscriptions),
 * but this provides a full reconciliation.
 */
async function syncSegmentMembers(members: CIOSegmentMember[]): Promise<SyncResult> {
  const startTime = Date.now();
  
  if (members.length === 0) {
    return { totalMembers: 0, reactivated: 0, inserted: 0, updated: 0, durationMs: 0 };
  }
  
  const normalizedMembers = members.map(m => ({
    ...m,
    email: m.email.toLowerCase(),
    proposedId: m.id && m.id.length > 0 ? m.id : generateId(),
    needsIdentify: !m.id || m.id.length === 0,
  }));
  
  const emails = normalizedMembers.map(m => m.email);
  const existingByEmail = await query<{ id: string; email: string; status: string }>(
    `SELECT id, email, status FROM subscribers WHERE email = ANY($1)`,
    [emails]
  );
  const emailToExisting = new Map(existingByEmail.rows.map(r => [r.email, r]));
  
  const proposedIds = normalizedMembers
    .filter(m => !emailToExisting.has(m.email))
    .map(m => m.proposedId);
  
  let idToExisting = new Map<string, { id: string }>();
  if (proposedIds.length > 0) {
    const existingByIdResult = await query<{ id: string }>(
      `SELECT id FROM subscribers WHERE id = ANY($1)`,
      [proposedIds]
    );
    idToExisting = new Map(existingByIdResult.rows.map(r => [r.id, r]));
  }
  
  const toReactivate: string[] = [];
  const toUpdateEmail: Array<{ id: string; email: string }> = [];
  const toInsert: Array<{ id: string; email: string; needsIdentify: boolean }> = [];
  
  for (const member of normalizedMembers) {
    const existing = emailToExisting.get(member.email);
    
    if (existing) {
      if (existing.status !== 'active') {
        toReactivate.push(existing.id);
      }
    } else {
      const idConflict = idToExisting.has(member.proposedId);
      
      if (idConflict) {
        toUpdateEmail.push({ id: member.proposedId, email: member.email });
      } else {
        toInsert.push({ 
          id: member.proposedId, 
          email: member.email, 
          needsIdentify: member.needsIdentify 
        });
      }
    }
  }
  
  if (toReactivate.length > 0) {
    await query(
      `UPDATE subscribers 
       SET status = 'active', 
           subscribed_at = COALESCE(subscribed_at, NOW()),
           unsubscribed_at = NULL,
           updated_at = NOW()
       WHERE id = ANY($1)`,
      [toReactivate]
    );
    console.log(`[Sync] Re-activated ${toReactivate.length} subscribers`);
  }
  
  if (toUpdateEmail.length > 0) {
    for (const { id, email } of toUpdateEmail) {
      await query(
        `UPDATE subscribers SET email = $1, updated_at = NOW() WHERE id = $2`,
        [email, id]
      );
    }
    console.log(`[Sync] Updated email for ${toUpdateEmail.length} subscribers`);
  }
  
  if (toInsert.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      
      batch.forEach((sub, idx) => {
        const offset = idx * 2;
        placeholders.push(`($${offset + 1}, $${offset + 2}, 'active', NOW(), NOW(), NOW())`);
        values.push(sub.id, sub.email);
      });
      
      await query(
        `INSERT INTO subscribers (id, email, status, subscribed_at, created_at, updated_at)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (id) DO NOTHING`,
        values
      );
    }
    console.log(`[Sync] Inserted ${toInsert.length} new subscribers`);
    
    const needsIdentify = toInsert.filter(s => s.needsIdentify);
    if (needsIdentify.length > 0) {
      console.log(`[Sync] Identifying ${needsIdentify.length} new subscribers to CIO...`);
      for (const { id, email } of needsIdentify) {
        try {
          await identifySubscriber(id, {
            email,
            subscription_status: 'active',
            subscribed_at: Math.floor(Date.now() / 1000),
          });
        } catch (err) {
          console.warn(`[Sync] Failed to identify ${id} to CIO:`, err);
        }
      }
    }
  }
  
  const durationMs = Date.now() - startTime;
  
  return {
    totalMembers: members.length,
    reactivated: toReactivate.length,
    inserted: toInsert.length,
    updated: toUpdateEmail.length,
    durationMs,
  };
}

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
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const segmentId = process.env.CUSTOMERIO_BROADCAST_SEGMENT_ID;
    
    if (!segmentId) {
      return NextResponse.json(
        { error: 'CUSTOMERIO_BROADCAST_SEGMENT_ID not configured' },
        { status: 400 }
      );
    }
    
    console.log(`[API] Segment sync started for segment ${segmentId}`);
    const fetchStart = Date.now();
    
    const segmentMembers = await fetchSegmentMembers(parseInt(segmentId, 10));
    const fetchDuration = Date.now() - fetchStart;
    
    console.log(`[API] Fetched ${segmentMembers.length} members in ${fetchDuration}ms`);
    
    if (segmentMembers.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Segment is empty',
        stats: {
          segmentId: parseInt(segmentId, 10),
          totalMembers: 0,
          fetchDurationMs: fetchDuration,
        },
      });
    }
    
    const syncResult = await syncSegmentMembers(segmentMembers);
    
    console.log(`[API] Sync complete: ${syncResult.totalMembers} members, ${syncResult.inserted} new, ${syncResult.reactivated} reactivated, ${syncResult.updated} updated`);
    
    return NextResponse.json({
      success: true,
      message: 'Segment synced successfully',
      stats: {
        segmentId: parseInt(segmentId, 10),
        totalMembers: syncResult.totalMembers,
        inserted: syncResult.inserted,
        reactivated: syncResult.reactivated,
        updated: syncResult.updated,
        fetchDurationMs: fetchDuration,
        syncDurationMs: syncResult.durationMs,
        totalDurationMs: fetchDuration + syncResult.durationMs,
      },
    });
  } catch (error) {
    console.error('[API] Segment sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync segment', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await getSession();
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const segmentId = process.env.CUSTOMERIO_BROADCAST_SEGMENT_ID;
  
  const subscriberStats = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text as count FROM subscribers GROUP BY status`
  );
  
  const stats = Object.fromEntries(
    subscriberStats.rows.map(r => [r.status, parseInt(r.count, 10)])
  );
  
  return NextResponse.json({
    message: 'Segment sync endpoint',
    usage: {
      method: 'POST',
      description: 'Syncs Customer.io segment members to DSQL subscribers table',
      headers: {
        'x-scheduled-job': 'true - for EventBridge scheduled jobs',
        'x-scheduler-secret': 'secret - required for scheduled jobs if SCHEDULER_SECRET is set',
      },
    },
    config: {
      segment_id: segmentId || 'not set',
    },
    current_dsql_stats: stats,
    notes: [
      'This endpoint fetches all members from the configured CIO segment',
      'Members are upserted into DSQL to enable signed vote URLs',
      'Run this before the first broadcast or after bulk CIO imports',
      'The webhook handles incremental updates for new subscriptions',
      'Parallelized CIO fetches + batched DSQL upserts for performance',
    ],
  });
}
