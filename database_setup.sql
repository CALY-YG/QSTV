-- 1. Create the watch_history table
CREATE TABLE IF NOT EXISTS public.watch_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vod_id BIGINT NOT NULL,
    vod_name TEXT NOT NULL,
    vod_pic TEXT,
    type_name TEXT,
    source_key TEXT NOT NULL,
    episode_index INTEGER NOT NULL,
    episode_name TEXT NOT NULL,
    playback_time DOUBLE PRECISION DEFAULT 0,
    watched_at BIGINT NOT NULL,
    
    -- Ensure a user only has one history record per video source
    UNIQUE(user_id, vod_id, source_key)
);

-- 2. Set up Row Level Security (RLS)
ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

-- 3. Create policies so users can only see and edit their OWN history
CREATE POLICY "Users can view their own history" 
ON public.watch_history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history" 
ON public.watch_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own history" 
ON public.watch_history FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own history" 
ON public.watch_history FOR DELETE 
USING (auth.uid() = user_id);
