
import { NextResponse } from 'next/server';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Define a specific, accurate interface for the data stored in Firestore for a Pod.
// This avoids relying on the front-end `Pod` type which includes derived fields.
interface ApiPod {
  id: string;
  name: string;
  logoUrl?: string;
  logoInitials?: string;
  logoBgColor?: string;
  campaignId: string;
  podManagerId: string;
  teamLeaderId: string;
  agentIds?: string[];
  teamsWebhookUrl?: string;
}

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
 * @apiSuccess {String} [pods.teamsWebhookUrl] Optional webhook URL for Microsoft Teams.
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
 *         "agentIds": ["user-agent-1", "user-agent-2"],
 *         "teamsWebhookUrl": "https://your-webhook-url"
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

    // Map the documents to the ApiPod interface.
    const pods: ApiPod[] = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.name || 'Unnamed Pod',
            campaignId: data.campaignId,
            podManagerId: data.podManagerId,
            teamLeaderId: data.teamLeaderId,
            agentIds: data.agentIds || [],
            logoUrl: data.logoUrl || '',
            logoInitials: data.logoInitials || '',
            logoBgColor: data.logoBgColor || '',
            teamsWebhookUrl: data.teamsWebhookUrl || '',
        };
    });

    return NextResponse.json(pods, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching pods:", error);
    // It's good practice to log the actual error on the server.
    return NextResponse.json({ error: `Failed to fetch pods. Server Error: ${error.message}` }, { status: 500 });
  }
}
