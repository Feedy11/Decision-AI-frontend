import { Injectable }      from '@angular/core';
import { HttpClient }      from '@angular/common/http';
import { Observable }      from 'rxjs';

import { AuthService } from './auth.service';
import { IA_API_BASE } from '../config/api-base';
import { AskRequest, AskResponse, ChatMessage, Conversation, CreateConversationRequest, CreateConversationResponse, SseEvent } from '../../models/chat.model';


@Injectable({ providedIn: 'root' })
export class ChatService {

  private readonly API = IA_API_BASE;

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  createConversation(
    datasetId: number,
    body: CreateConversationRequest = {}
  ): Observable<CreateConversationResponse> {
    return this.http.post<CreateConversationResponse>(
      `${this.API}/datasets/${datasetId}/conversations`, body
    );
  }

  listConversations(
    datasetId: number,
    skip = 0, limit = 20
  ): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(
      `${this.API}/datasets/${datasetId}/conversations?skip=${skip}&limit=${limit}`
    );
  }

  getMessages(
    datasetId: number,
    conversationId: number,
    limit = 50
  ): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(
      `${this.API}/datasets/${datasetId}/conversations/${conversationId}/messages?limit=${limit}`
    );
  }


  askMessage(
    datasetId: number,
    conversationId: number,
    body: AskRequest
  ): Observable<AskResponse> {
    return this.http.post<AskResponse>(
      `${this.API}/datasets/${datasetId}/conversations/${conversationId}/messages`,
      body
    );
  }

  streamMessage(
    datasetId: number,
    conversationId: number,
    message: string
  ): EventSource {
    const token = this.auth.getToken();
    const url   = `${this.API}/datasets/${datasetId}/conversations/${conversationId}/messages/stream?message=${encodeURIComponent(message)}`;

    // EventSource ne supporte pas les headers custom nativement
    //on passe le token en query param si le backend l'accepte
    //sinon utiliser un cookie ou une lib comme eventsource-polyfill.
    // Pour l'instant : token en query param
    const finalUrl = token ? `${url}&access_token=${token}` : url;
    return new EventSource(finalUrl);
  }


  rebuildIndex(datasetId: number): Observable<{ status: string; dataset_id: number; message: string }> {
    return this.http.post<any>(
      `${this.API}/datasets/${datasetId}/index`, {}
    );
  }

  //Helper : parser un event SSE
  parseSseEvent(eventType: string, data: string): SseEvent | null {
    try {
      return { type: eventType as any, data: JSON.parse(data) };
    } catch {
      return { type: eventType as any, data: { raw: data } };
    }
  }
}
