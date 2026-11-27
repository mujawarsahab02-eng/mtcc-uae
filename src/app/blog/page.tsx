import Link from "next/link";
import PublicNav from "@/components/PublicNav";
import Footer from "@/components/Footer";
import { WHATSAPP_PARTNER } from "@/lib/season";

export const metadata = {
  title: "How MTCC Began | MTCC U.A.E. Season 1 Story",
  description: "The story of how the Maharashtra Tennis Cricket Championship U.A.E. was built, from one message to a full day of cricket in Sharjah.",
};

const H = "font-display font-black text-2xl sm:text-3xl text-navyText mt-12 mb-4";
const P = "text-[17px] leading-relaxed text-navyText/85 mb-5";

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-warmWhite">
      <PublicNav />

      <div className="bg-cream py-14 text-center px-6">
        <div className="text-xs uppercase tracking-[0.3em] text-orange font-bold mb-3">Season 1 Story</div>
        <h1 className="font-display font-black text-4xl sm:text-5xl text-navyText mb-4">How MTCC Began</h1>
        <p className="text-slateText max-w-xl mx-auto italic">It started when Aman Chandiwala and Mudassir Khan came to Kaish Mujawar with an idea: why not a Maharashtra Premier League for the UAE?</p>
      </div>

      <article className="max-w-2xl mx-auto px-5 pb-16 pt-10">
        <p className={P}>
          About three months before the first ball, the idea took shape among a group of friends who already believed in it. The Maharashtrian community in the UAE had no cricket platform of its own, the way the South Indian communities have theirs. We wanted one that comes back every season, every year.
        </p>
        <p className={P}>
          Aman Chandiwala and Mudassir Khan approached Kaish Mujawar with the idea. Kaish then brought in Saeem Mukadam and Vijay Iyer, who had run a successful tournament about four years earlier. Rahil Sarguru of Imperial Aura Events had been pushing for a tournament for a long time, and he joined too. Together, the six of us became the core organisers. Noman was with us all along as part of the team.
        </p>

        <figure className="my-8">
          <img src="/season1/committee.jpg" alt="The MTCC U.A.E. core organising committee" loading="lazy" className="w-full h-auto rounded-xl shadow-md" />
          <figcaption className="text-xs text-slateText mt-2 text-center">The core organising committee</figcaption>
        </figure>

        <h2 className={H}>The question that never went away</h2>
        <p className={P}>
          Every time we sat down to discuss it, the same questions came up. Where will the funds come from? Where will the sponsors come from? If we promise prize money, where does it come from?
        </p>
        <p className={P}>
          The ground had to be booked. Trophies had to be bought. Prize money had to be paid out. Our entry and registration fees were limited and could never cover all of it, so the tournament depended on sponsors. And finding sponsors was the problem we kept coming back to.
        </p>

        <h2 className={H}>Aman and his questions</h2>
        <p className={P}>
          Aman was always the one with a question. Every time we thought something was settled, he came back with another &ldquo;what if&rdquo; or another exception. We used to laugh at him: <em>&ldquo;Bhai, tu hamesha kuch na kuch leke aata hai.&rdquo;</em> But in the end we had to answer every one of those questions, and the tournament was better planned because of it.
        </p>
        <p className={P}>
          To keep it all in one place, we created a WhatsApp group where we discussed everything: what&rsquo;s working, what&rsquo;s not, how will it happen. Most of this tournament was planned there.
        </p>
        <h2 className={H}>Convincing the owners</h2>
        <p className={P}>
          This was the thing that made it real. Mudassir Khan and Aman Chandiwala convinced the team owners to buy their teams and take part. An entry fee of AED 1,500 was not a small amount, and it was no easy yes. They explained the rules to each owner, again and again, and they kept answering the owners&rsquo; questions, because owners ask a lot of questions, and every one of them deserved an answer. We always put Mudassir at the front to explain things.
        </p>
        <p className={P}>
          When all the teams were confirmed and the entry fees were in, we knew from every side that the tournament was happening. Without the owners saying yes, there would have been no MTCC.
        </p>
        <p className={P}>
          We named it the Maharashtra Tennis Cricket Championship U.A.E. and made it auction-based: eight teams, a player auction, and a website built for the tournament, with live scores and squads.
        </p>

        <h2 className={H}>The auction</h2>
        <p className={P}>On 4 October, at the Seven Seas Hotel, the eight teams built their squads in a live player auction.</p>

        <h2 className={H}>All of us, together</h2>
        <p className={P}>
          There was no single person in charge of one thing. On the ground, all of us worked together: Aman, Mudassir, Noman, Saeem, Tariq, Saqib, Irbas and Kaish. We worked out together how every ground would run, and we followed each task through to the end.
        </p>
        <p className={P}>
          A few things deserve a mention. Vijay was the point of contact for the organising committee and ran the day, including the toss. Rahil looked after the sponsors and the influencers who came to the ground. Aman and Saeem went out to arrange the trophy, and they did a big part of that work. Before the day, Vijay and Saeem went looking for sponsors, and Aman, Mudassir and Noman took on the arrangements, the entry fees and the player registrations.
        </p>
        <p className={P}>
          Even while playing in the tournament himself, Kaish kept an eye on everything, and he built the tournament website on his own.
        </p>

        <h2 className={H}>The day</h2>
        <p className={P}>
          On Sunday 15 November 2026, at Farhan Cricket Ground in Al Batayeh, Sharjah, eight teams played 13 matches of five overs a side. Shams 11 Dubai won the title, and MI Mumbaikar finished as runners-up.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 my-8">
          <figure className="rounded-xl overflow-hidden" style={{ border: "2px solid #D4AF37" }}>
            <img src="/season1/champions.jpg" alt="Shams 11 Dubai, champions" loading="lazy" className="block w-full h-auto" />
            <figcaption className="px-3 py-2 text-sm font-bold text-navyText bg-white">🏆 Champions: Shams 11 Dubai</figcaption>
          </figure>
          <figure className="rounded-xl overflow-hidden border border-black/10">
            <img src="/season1/runner-up.jpg" alt="MI Mumbaikar, runners-up" loading="lazy" className="block w-full h-auto" />
            <figcaption className="px-3 py-2 text-sm font-bold text-navyText bg-white">Runners-up: MI Mumbaikar</figcaption>
          </figure>
        </div>

        <h2 className={H}>The people behind it</h2>
        <p className={P}>
          Our on-ground committee, Saqib Pathan, Tariq Israz and Irbas Qazi, kept the day running. Noman helped on the ground and did every task he was given. Desert Falcons CC, with their regular players, and Rahil Sarguru of Imperial Aura Events were key to its success. Bademiya and Bombay Masala Zaika fed everyone. Crick Stars, our team in India, looked after our social media, and they are working with us on the photos and videos from the tournament.
        </p>
        <p className={P}>
          To our sponsors, who solved the question we feared most: thank you. To every owner, player, volunteer and fan who came to Sharjah: this was yours.
        </p>

        <h2 className={H}>What&rsquo;s next</h2>
        <p className={P}>
          Season 1 was a success, with a few small hiccups and nothing major. We now want Season 2 to arrive with a blast, with more sponsors and a bigger day for the community. If your brand would like to be part of it, message us on WhatsApp.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <a href={WHATSAPP_PARTNER} target="_blank" rel="noopener noreferrer"
            className="text-center px-6 py-3.5 rounded-lg font-bold text-[#151005]" style={{ background: "linear-gradient(135deg,#D4AF37,#B8912C)" }}>
            Partner with us for Season 2
          </a>
          <Link href="/season-2" className="text-center px-6 py-3.5 rounded-lg font-bold text-navyText border-2 border-navyText/20">Register interest for Season 2</Link>
          <Link href="/gallery" className="text-center px-6 py-3.5 rounded-lg font-bold text-navyText border-2 border-navyText/20">See the Season 1 gallery</Link>
        </div>
      </article>

      <Footer />
    </div>
  );
}
