import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface ChatLog {
  user_id: string
  session_id?: string
  message: string
  reply: string
  response_time_ms?: number
  model_used?: string
  knowledge_sources?: number[]
  mem0_memories_used?: boolean
  user_feedback?: number
  metadata?: Record<string, any>
  timestamp: Date
  ip_address?: string
  user_agent?: string
  error_occurred?: boolean
  error_message?: string
}

interface UserSession {
  user_id: string
  session_data?: Record<string, any>
  preferences?: Record<string, any>
  total_messages?: number
  user_type?: string
  notes?: string
}

export class SupabaseService {
  private supabase: SupabaseClient

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not found. Chat logs will not be stored.')
      this.supabase = null as unknown as SupabaseClient
      return
    }

    this.supabase = createClient(supabaseUrl, supabaseKey)
  }

  async storeChatLog(chatLog: ChatLog): Promise<void> {
    if (!this.supabase) {
      console.log('Supabase not configured, skipping chat log storage')
      return
    }

    try {
      const { error } = await this.supabase
        .from('chat_logs')
        .insert({
          user_id: chatLog.user_id,
          session_id: chatLog.session_id,
          message: chatLog.message,
          reply: chatLog.reply,
          response_time_ms: chatLog.response_time_ms,
          model_used: chatLog.model_used || 'gpt-4',
          knowledge_sources: chatLog.knowledge_sources || [],
          mem0_memories_used: chatLog.mem0_memories_used || false,
          user_feedback: chatLog.user_feedback,
          metadata: chatLog.metadata || {},
          created_at: chatLog.timestamp.toISOString(),
          ip_address: chatLog.ip_address,
          user_agent: chatLog.user_agent,
          error_occurred: chatLog.error_occurred || false,
          error_message: chatLog.error_message
        })

      if (error) {
        console.error('Error storing chat log:', error)
      }
    } catch (error) {
      console.error('Error storing chat log:', error)
    }
  }

  async getChatHistory(userId: string, limit: number = 10): Promise<ChatLog[]> {
    if (!this.supabase) {
      return []
    }

    try {
      const { data, error } = await this.supabase
        .from('chat_logs')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error fetching chat history:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching chat history:', error)
      return []
    }
  }

  async updateUserSession(userId: string, sessionData?: Record<string, any>, preferences?: Record<string, any>): Promise<void> {
    if (!this.supabase) {
      return
    }

    try {
      const { error } = await this.supabase
        .rpc('update_user_session', {
          p_user_id: userId,
          p_session_data: sessionData,
          p_preferences: preferences
        })

      if (error) {
        console.error('Error updating user session:', error)
      }
    } catch (error) {
      console.error('Error updating user session:', error)
    }
  }

  async getChatAnalytics(startDate?: Date, endDate?: Date): Promise<any> {
    if (!this.supabase) {
      return null
    }

    try {
      const { data, error } = await this.supabase
        .rpc('get_chat_analytics', {
          start_date: startDate?.toISOString(),
          end_date: endDate?.toISOString()
        })

      if (error) {
        console.error('Error fetching chat analytics:', error)
        return null
      }

      return data?.[0] || null
    } catch (error) {
      console.error('Error fetching chat analytics:', error)
      return null
    }
  }

  async deleteUserData(userId: string): Promise<void> {
    if (!this.supabase) {
      return
    }

    try {
      // Delete from chat_logs
      const { error: chatLogsError } = await this.supabase
        .from('chat_logs')
        .delete()
        .eq('user_id', userId)

      if (chatLogsError) {
        console.error('Error deleting chat logs:', chatLogsError)
      }

      // Delete from user_sessions
      const { error: sessionError } = await this.supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', userId)

      if (sessionError) {
        console.error('Error deleting user session:', sessionError)
      }
    } catch (error) {
      console.error('Error deleting user data:', error)
    }
  }

  async getUserSession(userId: string): Promise<UserSession | null> {
    if (!this.supabase) {
      return null
    }

    try {
      const { data, error } = await this.supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error fetching user session:', error)
        return null
      }

      return data || null
    } catch (error) {
      console.error('Error fetching user session:', error)
      return null
    }
  }

  async cleanupOldData(retentionDays: number = 90): Promise<number> {
    if (!this.supabase) {
      return 0
    }

    try {
      const { data, error } = await this.supabase
        .rpc('cleanup_old_data', {
          retention_days: retentionDays
        })

      if (error) {
        console.error('Error cleaning up old data:', error)
        return 0
      }

      return data || 0
    } catch (error) {
      console.error('Error cleaning up old data:', error)
      return 0
    }
  }
}