import { getLatestComparison } from "@/lib/data";
import SweaterCard from "@/components/SweaterCard";
import ForecastCard from "@/components/ForecastCard";

export default async function HomePage() {
  const comp = await getLatestComparison();
  return (
    <>
      <SweaterCard comp={comp} />
      <ForecastCard />
    </>
  );
}
