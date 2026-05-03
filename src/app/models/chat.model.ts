
export interface Conversation {
  id              : number;
  dataset_id      : number;
  user_id        ?: string | null;
  title          ?: string | null;
  analysis_version?: string | null;
  created_at      : string;
  updated_at     ?: string | null;
}

export interface CreateConversationRequest {
  title?: string;
}

export interface CreateConversationResponse {
  conversation_id: number;
  dataset_id     : number;
  title          : string;
  created_at     : string;
}

//Messages
export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id             : number;
  conversation_id: number;
  role           : MessageRole;
  content        : string;
  intent        ?: string | null;
  chunk_ids     ?: string[] | null;
  latency_ms    ?: number | null;
  created_at     : string;
}

export interface AskRequest  { message: string; }

export interface AskResponse {
  message_id     : number;
  conversation_id: number;
  answer         : string;
  intent        ?: string | null;
  chunk_ids      : string[];
  chart_spec    ?: Record<string, any> | null;
  caveats        : string[];
  latency_ms     : number;
}

//SSE event types
export type SseEventType =
  | 'intent' | 'retrieval' | 'tool_start' | 'tool_result'
  | 'chart'  | 'token'     | 'done'       | 'error'
  | 'message_persisted';

export interface SseEvent {
  type: SseEventType;
  data: any;
}

//Chart spec (from VizAgent)
export interface ChartSpec {
  chart_type : 'bar' | 'line' | 'scatter' | 'heatmap' | 'pie' | 'histogram';
  x_col      : string;
  y_col     ?: string | null;
  agg_func  ?: string | null;
  title      : string;
  caption    : string;
  data       : Record<string, any>;
}

//Local UI message
export interface UiMessage {
  id         : number | string;   // string pour les messages temporaires
  role       : MessageRole;
  content    : string;
  timestamp  : Date;

  isStreaming?: boolean;
  chartSpec  ?: ChartSpec | null;
  intent    ?: string | null;
  latency_ms?: number | null;
  chunk_ids ?: string[] | null;
}
