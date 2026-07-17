-- Give updatedAt a default so trigger/direct inserts don't violate NOT NULL
ALTER TABLE public."User" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- Backfill any existing null updatedAt values
UPDATE public."User" SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;

-- Recreate handle_new_user() to explicitly set updatedAt (defensive)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public."User" (id, username, avatar, "updatedAt")
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    coalesce(new.raw_user_meta_data->>'avatar_url', 'https://via.placeholder.com/150'),
    CURRENT_TIMESTAMP
  );
  RETURN new;
END;
$function$;
