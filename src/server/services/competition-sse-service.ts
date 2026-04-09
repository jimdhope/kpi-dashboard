import { EventEmitter } from 'events';

interface SseMessage {
  type: string;
  data: any;
  timestamp: string;
}

class CompetitionEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(1000);
  }
}

// Global event emitter for competition events
const competitionEvents = new CompetitionEventEmitter();

export interface SseClient {
  id: string;
  competitionId: string;
  response: any;
}

class CompetitionSseService {
  private clients: Map<string, SseClient[]> = new Map();

  subscribe(competitionId: string, clientId: string, response: any) {
    if (!this.clients.has(competitionId)) {
      this.clients.set(competitionId, []);
    }
    
    const clients = this.clients.get(competitionId)!;
    clients.push({ id: clientId, competitionId, response });
    
    console.log(`Client ${clientId} subscribed to competition ${competitionId}. Total clients: ${clients.length}`);
  }

  unsubscribe(competitionId: string, clientId: string) {
    const clients = this.clients.get(competitionId);
    if (!clients) return;

    const index = clients.findIndex(c => c.id === clientId);
    if (index !== -1) {
      clients.splice(index, 1);
      console.log(`Client ${clientId} unsubscribed from competition ${competitionId}. Remaining: ${clients.length}`);
    }

    if (clients.length === 0) {
      this.clients.delete(competitionId);
    }
  }

  broadcast(competitionId: string, message: SseMessage) {
    const clients = this.clients.get(competitionId);
    if (!clients || clients.length === 0) return;

    const messageStr = `data: ${JSON.stringify({
      ...message,
      timestamp: new Date().toISOString(),
    })}\n\n`;

    clients.forEach(client => {
      try {
        client.response.write(messageStr);
      } catch (error) {
        console.error(`Error sending to client ${client.id}:`, error);
      }
    });
  }

  getClientCount(competitionId: string): number {
    return this.clients.get(competitionId)?.length || 0;
  }

  getAllClientCount(): number {
    let total = 0;
    this.clients.forEach(clients => {
      total += clients.length;
    });
    return total;
  }
}

export const competitionSseService = new CompetitionSseService();

// Also export the event emitter for direct event-based broadcasting
export const competitionEventsEmitter = competitionEvents;
