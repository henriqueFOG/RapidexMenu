import ScheduleClient from "./ScheduleClient";

export const dynamic = "force-dynamic";

export default async function SchedulePage({ params }: { params: Promise<{ slug: string }> }) {
  return <ScheduleClient slug={(await params).slug} />;
}
