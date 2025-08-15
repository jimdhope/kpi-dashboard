
import { NextResponse } from 'next/server';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Pod } from '@/app/(admin)/admin/pods/page';

/**
 * @api {get} /api/pods Request All Pods
 * @apiName GetPods
 * @apiGroup Pods
 *
 * @apiSuccess {Object[]} pods List of pods.
 * @apiSuccess {String} pods.id Pod's unique ID.
 * @apiSuccess {String} pods.name Name of the pod.
 * @apiSuccess {String} pods.campaignId ID of the campaign the pod belongs to.
 * @apiSuccess {String} pods.podManagerId ID of the pod manager.
 * @apiSuccess {String} pods.teamLeaderId ID of the team leader.
 * @apiSuccess {String[]} pods.agentIds List of agent IDs in the pod.
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     [
 *       {
 *         "id": "pod-123",
 *         "name": "Alpha Pod",
 *         "campaignId": "campaign-abc",
 *         "podManagerId": "user-manager-1",
 *         "teamLeaderId": "user-leader-1",
 *         "agentIds": ["user-agent-1", "user-agent-2"]
 *       }
 *     ]
 *
 * @apiError (500) {String} error An error message indicating failure.
 */
export async function GET() {
  try {
    const podsCollectionRef = collection(db, 'pods');
    const q = query(podsCollectionRef, orderBy('name'));
    const querySnapshot = await getDocs(q);

    const pods: Omit<Pod, 'campaignName' | 'podManagerName' | 'teamLeaderName' | 'agentNames'>[] = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      name: doc.data().name,
      campaignId: doc.data().campaignId,
      podManagerId: doc.data().podManagerId,
      teamLeaderId: doc.data().teamLeaderId,
      agentIds: doc.data().agentIds || [],
      logoUrl: doc.data().logoUrl || '',
      logoInitials: doc.data().logoInitials || '',
      logoBgColor: doc.data().logoBgColor || '',
      teamsWebhookUrl: doc.data().teamsWebhookUrl || '',
    }));

    return NextResponse.json(pods, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching pods:", error);
    return NextResponse.json({ error: "Failed to fetch pods" }, { status: 500 });
  }
}

// Optional: You can add POST, PUT, DELETE functions here later for full CRUD functionality.
// For example:
// export async function POST(request: Request) { ... }
