import { query } from './db';
import { generateId } from './ulid';
import { triggerRecapBroadcast } from './customerio';
import { getRequiredBaseUrl } from './url';
import {
  Poll,
  PollOption,
  PollWithBriefing,
  RecapSend,
  RecapResultOption,
  RecapResultsSnapshot,
  RecapSendResult,
} from '@/types';

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_MIN_VOTES = parseInt(process.env.RECAP_MIN_VOTES || '10', 10);

// ============================================================================
// Get Today's Active Poll Results
// ============================================================================

interface PollWithResults extends PollWithBriefing {
  options: Array<PollOption & { vote_count: number }>;
  total_votes: number;
}

async function getTodaysActivePoll(): Promise<PollWithResults | null> {
  try {
    const pollResult = await query<PollWithBriefing>(
      `SELECT id, question, status, published_at, briefing_background, briefing_conservative, briefing_liberal, briefing_centrist
       FROM polls 
       WHERE status = 'active' 
       ORDER BY published_at DESC 
       LIMIT 1`
    );
    
    if (pollResult.rows.length === 0) {
      return null;
    }
    
    const poll = pollResult.rows[0];
    
    const optionsResult = await query<PollOption & { vote_count: string }>(
      `SELECT po.id, po.poll_id, po.option_text, po.display_order,
              COALESCE(v.vote_count, 0) as vote_count
       FROM poll_options po
       LEFT JOIN (
         SELECT option_id, COUNT(*) as vote_count
         FROM votes
         WHERE poll_id = $1
         GROUP BY option_id
       ) v ON po.id = v.option_id
       WHERE po.poll_id = $1
       ORDER BY po.display_order`,
      [poll.id]
    );
    
    const options = optionsResult.rows.map(opt => ({
      ...opt,
      vote_count: parseInt(String(opt.vote_count), 10),
    }));
    
    const totalVotes = options.reduce((sum, opt) => sum + opt.vote_count, 0);
    
    return {
      ...poll,
      options,
      total_votes: totalVotes,
    };
  } catch (error) {
    console.error('[RECAP] Error fetching today\'s poll:', error);
    return null;
  }
}

// ============================================================================
// Calculate Percentages
// ============================================================================

function calculatePercentages(
  options: Array<PollOption & { vote_count: number }>,
  totalVotes: number
): RecapResultOption[] {
  if (totalVotes === 0) {
    return options.map(opt => ({
      optionText: opt.option_text,
      percentage: 0,
      displayOrder: opt.display_order,
    }));
  }
  
  const percentages = options.map(opt => ({
    optionText: opt.option_text,
    rawPercentage: (opt.vote_count / totalVotes) * 100,
    displayOrder: opt.display_order,
  }));
  
  const roundedPercentages = percentages.map(p => ({
    ...p,
    percentage: Math.round(p.rawPercentage),
  }));
  
  const totalRounded = roundedPercentages.reduce((sum, p) => sum + p.percentage, 0);
  
  if (totalRounded !== 100 && totalVotes > 0) {
    const diff = 100 - totalRounded;
    const sortedByRemainder = [...roundedPercentages]
      .map((p, i) => ({ index: i, remainder: percentages[i].rawPercentage - p.percentage }))
      .sort((a, b) => Math.abs(b.remainder) - Math.abs(a.remainder));
    
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        roundedPercentages[sortedByRemainder[i % sortedByRemainder.length].index].percentage++;
      }
    } else {
      for (let i = 0; i < Math.abs(diff); i++) {
        const idx = sortedByRemainder[i % sortedByRemainder.length].index;
        if (roundedPercentages[idx].percentage > 0) {
          roundedPercentages[idx].percentage--;
        }
      }
    }
  }
  
  return roundedPercentages.map(p => ({
    optionText: p.optionText,
    percentage: p.percentage,
    displayOrder: p.displayOrder,
  }));
}

// ============================================================================
// Build Recap Snapshot
// ============================================================================

function buildRecapSnapshot(poll: PollWithResults, baseUrl: string): RecapResultsSnapshot {
  const percentages = calculatePercentages(poll.options, poll.total_votes);
  
  let briefingExcerpt = '';
  if (poll.briefing_background) {
    const sentences = poll.briefing_background
      .replace(/\[SAMPLE DATA\]\s*/g, '')
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 0);
    briefingExcerpt = sentences.slice(0, 2).join('. ').trim();
    if (briefingExcerpt && !briefingExcerpt.endsWith('.')) {
      briefingExcerpt += '.';
    }
  }
  
  return {
    question: poll.question,
    options: percentages.sort((a, b) => a.displayOrder - b.displayOrder),
    briefingExcerpt,
    resultsUrl: `${baseUrl}/polls/${poll.id}`,
  };
}

// ============================================================================
// Check for Existing Recap Send
// ============================================================================

async function hasRecapBeenSent(pollId: string, date: Date): Promise<boolean> {
  const dateStr = date.toISOString().split('T')[0];
  
  const result = await query<{ id: string }>(
    `SELECT id FROM recap_sends 
     WHERE poll_id = $1 AND send_date = $2 AND status IN ('sent', 'sending')
     LIMIT 1`,
    [pollId, dateStr]
  );
  
  return result.rows.length > 0;
}

// ============================================================================
// Create Recap Send Record
// ============================================================================

async function createRecapSendRecord(
  pollId: string,
  date: Date,
  totalVotes: number,
  minVotes: number,
  snapshot: RecapResultsSnapshot
): Promise<string> {
  const id = generateId();
  const dateStr = date.toISOString().split('T')[0];
  
  await query(
    `INSERT INTO recap_sends 
     (id, poll_id, send_date, status, total_votes, vote_threshold, results_snapshot_json, created_at)
     VALUES ($1, $2, $3, 'pending', $4, $5, $6, NOW())`,
    [id, pollId, dateStr, totalVotes, minVotes, JSON.stringify(snapshot)]
  );
  
  return id;
}

// ============================================================================
// Update Recap Send Record
// ============================================================================

async function updateRecapSend(
  recapId: string,
  updates: Partial<{
    status: string;
    broadcast_campaign_id: string;
    subscribers_sent_to: number;
    sent_at: Date;
    skipped: boolean;
    skip_reason: string;
    error_message: string;
  }>
): Promise<void> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }
  
  if (setClauses.length === 0) return;
  
  values.push(recapId);
  
  await query(
    `UPDATE recap_sends SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
}

// ============================================================================
// Main Recap Sending Function
// ============================================================================

export async function sendNightlyRecap(
  options: { minVotes?: number } = {}
): Promise<RecapSendResult> {
  const minVotes = options.minVotes ?? DEFAULT_MIN_VOTES;
  const today = new Date();
  
  console.log(`[RECAP] Starting nightly recap send (min votes: ${minVotes})`);
  
  let baseUrl: string;
  try {
    baseUrl = getRequiredBaseUrl();
  } catch (error) {
    console.error('[RECAP] Base URL not configured:', error);
    return {
      success: false,
      recapId: '',
      error: error instanceof Error ? error.message : 'Base URL not configured',
    };
  }
  
  const poll = await getTodaysActivePoll();
  
  if (!poll) {
    console.log('[RECAP] No active poll found, skipping recap');
    return {
      success: true,
      recapId: '',
      skipped: true,
      skipReason: 'No active poll found',
    };
  }
  
  const alreadySent = await hasRecapBeenSent(poll.id, today);
  
  if (alreadySent) {
    console.log(`[RECAP] Recap already sent for poll ${poll.id} today`);
    return {
      success: true,
      recapId: '',
      skipped: true,
      skipReason: 'Recap already sent today',
    };
  }
  
  const snapshot = buildRecapSnapshot(poll, baseUrl);
  const recapId = await createRecapSendRecord(
    poll.id,
    today,
    poll.total_votes,
    minVotes,
    snapshot
  );
  
  if (poll.total_votes < minVotes) {
    console.log(`[RECAP] Too few votes (${poll.total_votes} < ${minVotes}), skipping`);
    
    await updateRecapSend(recapId, {
      status: 'skipped',
      skipped: true,
      skip_reason: `Insufficient votes: ${poll.total_votes} < ${minVotes} minimum`,
    });
    
    return {
      success: true,
      recapId,
      skipped: true,
      skipReason: `Too few votes (${poll.total_votes})`,
    };
  }
  
  try {
    await updateRecapSend(recapId, { status: 'sending' });
    
    const campaignId = process.env.CUSTOMERIO_RECAP_CAMPAIGN_ID;
    
    if (!campaignId) {
      throw new Error('CUSTOMERIO_RECAP_CAMPAIGN_ID not configured');
    }
    
    const broadcastData = {
      poll_id: poll.id,
      poll_question: poll.question,
      results: snapshot.options.map(opt => ({
        text: opt.optionText,
        percentage: opt.percentage,
        bar_width: opt.percentage,
      })),
      briefing_excerpt: snapshot.briefingExcerpt,
      results_url: snapshot.resultsUrl,
    };
    
    const result = await triggerRecapBroadcast(campaignId, broadcastData);
    
    await updateRecapSend(recapId, {
      status: 'sent',
      broadcast_campaign_id: campaignId,
      subscribers_sent_to: result.subscriberCount,
      sent_at: new Date(),
    });
    
    console.log(`[RECAP] Successfully sent recap to ${result.subscriberCount} subscribers`);
    
    return {
      success: true,
      recapId,
      subscriberCount: result.subscriberCount,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await updateRecapSend(recapId, {
      status: 'failed',
      error_message: errorMessage,
    });
    
    console.error('[RECAP] Failed to send recap:', errorMessage);
    
    return {
      success: false,
      recapId,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Get Recap Preview (for admin/debugging)
// ============================================================================

export async function getRecapPreview(): Promise<RecapResultsSnapshot | null> {
  const poll = await getTodaysActivePoll();
  
  if (!poll) {
    return null;
  }
  
  const baseUrl = getRequiredBaseUrl();
  return buildRecapSnapshot(poll, baseUrl);
}

// ============================================================================
// Utility: Format percentage bar for email (HTML)
// ============================================================================

export function formatPercentageBar(percentage: number, color: string = '#0066b3'): string {
  const barWidth = Math.max(percentage, 2);
  
  return `
    <div style="background-color: #e5e5e5; border-radius: 4px; height: 20px; margin: 4px 0;">
      <div style="background-color: ${color}; border-radius: 4px; height: 100%; width: ${barWidth}%;"></div>
    </div>
  `.trim();
}
