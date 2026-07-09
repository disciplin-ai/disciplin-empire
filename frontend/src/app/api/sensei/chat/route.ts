// src/app/api/sensei/chat/route.ts

import { NextRequest } from "next/server";
import { POST as senseiPost } from "../route";

export async function POST(req: NextRequest) {
  return senseiPost(req);
}