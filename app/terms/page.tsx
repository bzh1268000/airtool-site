"use client";

import { useRouter } from "next/navigation";

export default function TermsPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#f7f7f2] px-4 py-12">
      <div className="mx-auto max-w-4xl rounded-3xl border border-black/10 bg-white p-8 shadow-md md:p-10">
        <div className="mb-8 text-center">
          <div className="text-3xl font-bold text-[#2f641f]">AirTool.nz</div>
          <div className="mt-2 text-sm uppercase tracking-widest text-black/50">
            Terms &amp; Conditions
          </div>
        </div>

        <div className="prose prose-sm max-w-none text-black/75 md:prose-base">
          <p>
            Welcome to AirTool. By using this platform, creating an account, logging in,
            browsing listings, booking tools, or continuing with Google, you agree to
            these Terms &amp; Conditions.
          </p>

          <h2>1. Platform Role</h2>
          <p>
            AirTool operates as an online marketplace connecting tool owners
            (&quot;Owners&quot;), hubs, and renters (&quot;Renters&quot;). Unless clearly stated
            otherwise, AirTool does not own, manufacture, or personally supply the tools
            listed on the platform.
          </p>

          <h2>2. User Responsibility</h2>
          <p>Users agree that:</p>
          <ul>
            <li>They use tools at their own risk.</li>
            <li>They are responsible for checking whether a tool is suitable for their intended use.</li>
            <li>They will operate tools safely and lawfully.</li>
            <li>They will not allow unqualified or unauthorised persons to use rented tools.</li>
          </ul>

          <h2>3. Owner and Hub Responsibility</h2>
          <p>Owners and hubs are responsible for ensuring that tools they list are:</p>
          <ul>
            <li>Accurately described</li>
            <li>In safe and usable condition</li>
            <li>Made available only where lawful to do so</li>
          </ul>
          <p>
            AirTool does not guarantee the condition, quality, performance, or fitness for
            purpose of any listed tool.
          </p>

          <h2>4. Accounts and Registration</h2>
          <p>
            Users must provide accurate information when registering. You are responsible
            for keeping your login details secure and for all activity carried out under
            your account.
          </p>

          <h2>5. Bookings and Payments</h2>
          <p>
            All bookings made through AirTool are subject to availability, approval rules,
            and payment requirements shown at the time of booking.
          </p>
          <ul>
            <li>AirTool may collect and process payments through the platform.</li>
            <li>AirTool may hold funds temporarily while a booking is in progress.</li>
            <li>Platform fees, deposits, and other charges may apply.</li>
          </ul>

          <h2>6. Damage, Loss, and Late Return</h2>
          <p>
            Renters are responsible for returning tools on time and in the condition
            required under the booking. Renters may be charged for:
          </p>
          <ul>
            <li>Damage</li>
            <li>Loss</li>
            <li>Missing parts</li>
            <li>Cleaning</li>
            <li>Late return</li>
          </ul>

          <h2>7. Cancellations and Refunds</h2>
          <p>
            Cancellation and refund outcomes may depend on timing, tool type, owner or hub
            rules, and whether the booking has already started. AirTool may review disputes
            and make final platform decisions on refunds where needed.
          </p>

          <h2>8. Prohibited Use</h2>
          <p>Users must not:</p>
          <ul>
            <li>Use tools illegally or unsafely</li>
            <li>Provide false or misleading account information</li>
            <li>Attempt to bypass the platform to avoid fees</li>
            <li>Abuse, threaten, or harass other users</li>
            <li>List fake, unsafe, or prohibited items</li>
          </ul>

          <h2>9. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, AirTool is not liable for any direct,
            indirect, incidental, special, or consequential loss, including:
          </p>
          <ul>
            <li>Personal injury</li>
            <li>Property damage</li>
            <li>Loss of income</li>
            <li>Project delay</li>
            <li>Data loss</li>
          </ul>
          <p>
            AirTool&apos;s role is limited to providing the platform unless expressly stated
            otherwise.
          </p>

          <h2>10. Suspension and Termination</h2>
          <p>
            AirTool may suspend, restrict, or terminate an account or listing at any time
            if we believe a user has breached these Terms, created risk, or acted
            dishonestly or unsafely.
          </p>

          <h2>11. Privacy</h2>
          <p>
            By using the platform, you agree that AirTool may collect and use your account,
            booking, and contact information for platform operation, support, fraud
            prevention, and compliance purposes.
          </p>

          <h2>12. Changes to These Terms</h2>
          <p>
            AirTool may update these Terms from time to time. Continued use of the platform
            after updates means you accept the revised Terms.
          </p>

          <h2>13. Governing Law</h2>
          <p>These Terms are governed by the laws of New Zealand.</p>

          <h2>14. Contact</h2>
          <p>
            If you have questions about these Terms, please contact AirTool through the
            platform contact details provided on the website.
          </p>
        </div>

        <div className="mt-10 flex justify-center">
          <button
            onClick={() => router.push("/register?acceptedTerms=1")}
            className="rounded-xl bg-[#8bbb46] px-6 py-3 text-sm font-semibold text-white hover:bg-[#7aaa39]"
          >
            Accept the Terms
          </button>
        </div>
      </div>
    </main>
  );
}