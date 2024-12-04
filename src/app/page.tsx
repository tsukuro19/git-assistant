import Link from "next/link";

import { LatestPost } from "@/app/_components/post";
import { api, HydrateClient } from "@/trpc/server";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@clerk/nextjs";

export default async function Home() {
  return (
    <SignOutButton>
      <Button>Sign Out</Button>
    </SignOutButton>
  )
}
