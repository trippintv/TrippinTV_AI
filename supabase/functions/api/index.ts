import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status)
}

async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace(/^Bearer\s+/i, '')
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  )
  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method

    // --- ROUTING LOGIC ---

    // 1. Users API
    if (path.endsWith('/users')) {
      const user = await getUser(req)
      if (!user) return errorResponse('Unauthorized', 401)

      if (method === 'GET') {
        const userId = url.searchParams.get('id')
        if (userId) {
          if (!UUID_RE.test(userId)) return errorResponse('Invalid id', 400)
          const { data, error } = await supabaseClient
            .from('User')
            .select('*')
            .eq('id', userId)
            .single()
          if (error) throw error
          return jsonResponse(data)
        }
        const { data: me, error: meError } = await supabaseClient
          .from('User')
          .select('isAdmin')
          .eq('id', user.id)
          .single()
        if (meError) throw meError
        if (!me?.isAdmin) return errorResponse('Forbidden', 403)

        const { data, error } = await supabaseClient.from('User').select('*')
        if (error) throw error
        return jsonResponse(data)
      }
    }

    // 2. Videos API
    if (path.endsWith('/videos')) {
      const user = await getUser(req)
      if (!user) return errorResponse('Unauthorized', 401)

      if (method === 'GET') {
        const { data, error } = await supabaseClient
          .from('Video')
          .select('*, comments(*)')
          .order('createdAt', { ascending: false })
        if (error) throw error
        return jsonResponse(data)
      }

      if (method === 'POST') {
        let body: Record<string, unknown>
        try {
          body = await req.json()
        } catch {
          return errorResponse('Invalid JSON body', 400)
        }
        const { data, error } = await supabaseClient
          .from('Video')
          .insert([{
            userId: user.id,
            username: body.username,
            title: body.title,
            description: body.description,
            videoUrl: body.videoUrl,
            thumbnailUrl: body.thumbnailUrl,
            category: body.category,
          }])
          .select()
          .single()
        if (error) throw error
        return jsonResponse(data, 201)
      }
    }

    // 2b. Per-video comments
    const videoCommentsMatch = path.match(/\/videos\/([^/]+)\/comments$/)
    if (videoCommentsMatch && method === 'GET') {
      const user = await getUser(req)
      if (!user) return errorResponse('Unauthorized', 401)

      const videoId = videoCommentsMatch[1]
      if (!UUID_RE.test(videoId)) return errorResponse('Invalid video id', 400)
      const { data, error } = await supabaseClient
        .from('Comment')
        .select('*')
        .eq('videoId', videoId)
        .order('createdAt', { ascending: true })
      if (error) throw error
      return jsonResponse(data)
    }

    // 3. Comments API
    if (path.endsWith('/comments') && method === 'POST') {
      const user = await getUser(req)
      if (!user) return errorResponse('Unauthorized', 401)

      let body: Record<string, unknown>
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 400)
      }
      const videoId = body.videoId
      const validVideo = typeof videoId === 'string' && UUID_RE.test(videoId)
      if (!validVideo) return errorResponse('A valid videoId is required', 400)
      if (typeof body.text !== 'string' || body.text.trim() === '') {
        return errorResponse('text is required', 400)
      }

      const { data, error } = await supabaseClient
        .from('Comment')
        .insert([{
          userId: user.id,
          videoId,
          username: body.username,
          avatar: body.avatar,
          text: body.text,
          parentId: body.parentId ?? null,
        }])
        .select()
        .single()
      if (error) throw error
      return jsonResponse(data, 201)
    }

    // 4. Messages API
    if (path.endsWith('/messages')) {
      const user = await getUser(req)
      if (!user) return errorResponse('Unauthorized', 401)

      if (method === 'GET') {
        const u1 = url.searchParams.get('u1')
        const u2 = url.searchParams.get('u2')
        if (!u1 || !u2 || !UUID_RE.test(u1) || !UUID_RE.test(u2)) {
          return errorResponse('u1 and u2 must be valid user ids', 400)
        }
        if (user.id !== u1 && user.id !== u2) {
          return errorResponse('Forbidden', 403)
        }
        const { data, error } = await supabaseClient
          .from('Message')
          .select('*')
          .or(
            `and(senderId.eq.${u1},receiverId.eq.${u2}),and(senderId.eq.${u2},receiverId.eq.${u1})`
          )
          .order('createdAt', { ascending: true })
        if (error) throw error
        return jsonResponse(data)
      }

      if (method === 'POST') {
        let body: Record<string, unknown>
        try {
          body = await req.json()
        } catch {
          return errorResponse('Invalid JSON body', 400)
        }
        const receiverId = body.receiverId
        if (typeof receiverId !== 'string' || !UUID_RE.test(receiverId)) {
          return errorResponse('Invalid receiverId', 400)
        }
        const { data, error } = await supabaseClient
          .from('Message')
          .insert([{ senderId: user.id, receiverId, text: body.text }])
          .select()
          .single()
        if (error) throw error
        return jsonResponse(data, 201)
      }
    }

    // 5. Posts API (text-only posts, no video)
    if (path.endsWith('/posts')) {
      const user = await getUser(req)
      if (!user) return errorResponse('Unauthorized', 401)

      if (method === 'GET') {
        const { data, error } = await supabaseClient
          .from('Post')
          .select('*, comments(*)')
          .order('createdAt', { ascending: false })
        if (error) throw error
        return jsonResponse(data)
      }

      if (method === 'POST') {
        let body: Record<string, unknown>
        try {
          body = await req.json()
        } catch {
          return errorResponse('Invalid JSON body', 400)
        }
        if (typeof body.text !== 'string' || body.text.trim() === '') {
          return errorResponse('text is required', 400)
        }
        const { data, error } = await supabaseClient
          .from('Post')
          .insert([{
            userId: user.id,
            username: body.username,
            title: body.title ?? null,
            text: body.text,
            category: body.category ?? null,
          }])
          .select()
          .single()
        if (error) throw error
        return jsonResponse(data, 201)
      }
    }

    // 5b. Per-post comments
    const postCommentsMatch = path.match(/\/posts\/([^/]+)\/comments$/)
    if (postCommentsMatch && method === 'GET') {
      const user = await getUser(req)
      if (!user) return errorResponse('Unauthorized', 401)

      const postId = postCommentsMatch[1]
      if (!UUID_RE.test(postId)) return errorResponse('Invalid post id', 400)
      const { data, error } = await supabaseClient
        .from('Comment')
        .select('*')
        .eq('postId', postId)
        .order('createdAt', { ascending: true })
      if (error) throw error
      return jsonResponse(data)
    }

    // 5c. Comments on a post
    if (path.endsWith('/post-comments') && method === 'POST') {
      const user = await getUser(req)
      if (!user) return errorResponse('Unauthorized', 401)

      let body: Record<string, unknown>
      try {
        body = await req.json()
      } catch {
        return errorResponse('Invalid JSON body', 400)
      }
      const postId = body.postId
      if (typeof postId !== 'string' || !UUID_RE.test(postId)) {
        return errorResponse('A valid postId is required', 400)
      }
      if (typeof body.text !== 'string' || body.text.trim() === '') {
        return errorResponse('text is required', 400)
      }
      const { data, error } = await supabaseClient
        .from('Comment')
        .insert([{
          userId: user.id,
          postId,
          username: body.username,
          avatar: body.avatar,
          text: body.text,
          parentId: body.parentId ?? null,
        }])
        .select()
        .single()
      if (error) throw error
      return jsonResponse(data, 201)
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders })

  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unknown error', 500)
  }
})
