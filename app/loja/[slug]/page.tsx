import StoreClient from "./StoreClient";

export const dynamic = "force-dynamic";

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  return <StoreClient slug={(await params).slug} />;
}
