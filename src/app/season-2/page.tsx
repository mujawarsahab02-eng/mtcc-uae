import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";
import Season2Form from "./Season2Form";

export const metadata = { title: "Season 2 | MTCC U.A.E." };

export default function Season2Page() {
  return (
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />
      <div className="bg-cream py-12 text-center px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-2">Season 2</div>
        <h1 className="font-display font-black text-3xl text-navyText mb-2">Be Part of Season 2</h1>
        <p className="text-sm text-slateText max-w-md mx-auto">Season 1 was a success thanks to you. Tell us you are in and we will contact you as soon as Season 2 details are ready.</p>
      </div>
      <div className="max-w-lg mx-auto px-6 py-8">
        <Season2Form />
      </div>
      <Footer />
    </div>
  );
}
