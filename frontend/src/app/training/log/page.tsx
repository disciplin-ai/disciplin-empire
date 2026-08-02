import { notFound } from "next/navigation";
import TrainingLogClient from "./TrainingLogClient";

/*
  The training log's save control is labelled "Save session (stub)" and
  persists nothing. An unfinished form that discards an athlete's session is
  worse than no form at all, so it stays out of production until it saves.
*/
export default function TrainingLogPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <TrainingLogClient />;
}
