import Home from "@/pages/Home";

export default async function Page({ params }: { params: Promise<{ category: string; subcategory: string }> }) {
  const { category, subcategory } = await params;
  return <Home categorySlug={category} subcategorySlug={subcategory} />;
}
