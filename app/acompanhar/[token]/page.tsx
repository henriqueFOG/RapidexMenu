import TrackingClient from "./TrackingClient";

export const dynamic = "force-dynamic";

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  return <TrackingClient token={(await params).token} />;
}
