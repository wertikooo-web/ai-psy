"use client";

import { useRouter } from "next/navigation";
import { RelaxScene } from "@/components/relax/RelaxScene";

export default function RelaxPage() {
  const router = useRouter();
  return <RelaxScene onClose={() => router.back()} />;
}
