import Home from "@/pages/Home";

export default async function Page({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  return <Home categorySlug={category} />;
}
