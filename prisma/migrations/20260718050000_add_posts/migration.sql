-- Add text-only posts (posts without videos) and allow comments on both videos and posts.

CREATE TABLE IF NOT EXISTS "Post" (
    "id" TEXT NOT NULL,
    "userId" uuid NOT NULL,
    "username" TEXT NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Post_userId_idx" ON "Post"("userId");

ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ReactionOnPost" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" uuid NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReactionOnPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReactionOnPost_postId_userId_type_key" ON "ReactionOnPost"("postId", "userId", "type");

ALTER TABLE "ReactionOnPost" ADD CONSTRAINT "ReactionOnPost_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReactionOnPost" ADD CONSTRAINT "ReactionOnPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comment can now belong to a video OR a post (not both required).
ALTER TABLE "Comment" ADD COLUMN "postId" TEXT;
CREATE INDEX IF NOT EXISTS "Comment_videoId_idx" ON "Comment"("videoId");
CREATE INDEX IF NOT EXISTS "Comment_postId_idx" ON "Comment"("postId");
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
