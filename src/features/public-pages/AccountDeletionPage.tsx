import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserX, ShieldAlert, ArrowLeft, Mail, FileText, CheckCircle2 } from 'lucide-react';
import PublicPageLayout from './components/PublicPageLayout';

export const AccountDeletionPage: React.FC = () => {
  useEffect(() => {
    document.title = 'SpiralDine | Account Deletion Instructions';
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, []);

  return (
    <PublicPageLayout>
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16 text-left">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-[#D65336] hover:underline mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        <div className="space-y-4 mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-600 text-xs font-bold">
            <UserX className="w-3.5 h-3.5" />
            User Rights & Data Erasure
          </div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold tracking-tight text-[#17202A]">
            Account & Data Deletion Instructions
          </h1>
          <p className="text-sm text-[#667085]">
            Transparent guidance under the Digital Personal Data Protection Act, 2023 & GDPR
          </p>
        </div>

        <div className="space-y-8 text-sm text-[#344054] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">1. Your Right to Erasure</h2>
            <p>
              At SpiralDine, you possess the right to delete your customer account and erase your personal data at any time. When you request account deletion, we immediately revoke authentication credentials and permanently remove your personal profile information.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">2. How to Delete Your Account (In-App)</h2>
            <p>
              If you have access to your SpiralDine customer account, you can initiate immediate self-service account deletion directly from the application:
            </p>
            <div className="bg-white border border-[#E8DED6] rounded-xl p-5 space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D65336] text-white flex items-center justify-center font-bold text-xs shrink-0">1</span>
                <p className="text-xs">
                  Sign in to your customer account and navigate to <Link to="/customer/profile" className="text-[#D65336] font-semibold underline">Profile &amp; Settings</Link>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D65336] text-white flex items-center justify-center font-bold text-xs shrink-0">2</span>
                <p className="text-xs">
                  Select the <strong>Privacy &amp; Security</strong> tab from the settings menu.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D65336] text-white flex items-center justify-center font-bold text-xs shrink-0">3</span>
                <p className="text-xs">
                  Scroll to the <strong>Danger Zone</strong> section and click <strong>Delete Account &amp; Erase Personal Data</strong>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#D65336] text-white flex items-center justify-center font-bold text-xs shrink-0">4</span>
                <p className="text-xs">
                  Confirm your deletion choice. Your active sessions will be terminated and your profile deleted.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">3. How to Request Deletion via Email (Manual Request)</h2>
            <p>
              If you are unable to log in or wish to request data erasure on behalf of an authorized representative, you may submit a formal request to our Privacy Cell:
            </p>
            <div className="p-4 bg-white border border-[#E8DED6] rounded-xl text-xs space-y-2">
              <p><strong>Send an email to:</strong> <a href="mailto:privacy@restaurantos.com" className="text-[#D65336] underline font-semibold">privacy@restaurantos.com</a></p>
              <p><strong>Subject:</strong> <code>Data Erasure Request - [Your Registered Email or Phone Number]</code></p>
              <p><strong>Processing Time:</strong> Requests are verified and fulfilled within 7 business days in accordance with statutory requirements.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">4. What Data Is Deleted Immediately</h2>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Customer profile name, email address, password hashes, and phone numbers.</span>
              </li>
              <li className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Saved dietary preferences, allergen flags, and favourite restaurant bookmarks.</span>
              </li>
              <li className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Active table sessions, push notification tokens, and local cache entries.</span>
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">5. Statutory Data Retention (Legal Compliance)</h2>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                Statutory Financial Retention Requirements
              </div>
              <p>
                In compliance with Section 36 of the Central Goods and Services Tax (CGST) Act, 2017 and applicable tax laws in India, finalized tax invoices, GST breakdowns, and transaction identifiers associated with completed orders must be retained by restaurant merchants for a minimum statutory period of <strong>72 months (6 years)</strong> from the due date of furnishing the annual return for the relevant fiscal year.
              </p>
              <p>
                Upon account deletion, all personal contact information is disassociated and redacted from customer accounts. The anonymized financial records are retained solely for lawful taxation, audit, and fraud dispute purposes.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#17202A]">6. Contact the Grievance Officer</h2>
            <p>
              If you have any grievance or dispute regarding your personal data or account erasure, contact:
            </p>
            <div className="p-4 bg-white border border-[#E8DED6] rounded-xl text-xs space-y-1">
              <p><strong>Grievance Officer:</strong> Spiral World Compliance Office</p>
              <p><strong>Email:</strong> <a href="mailto:grievance@restaurantos.com" className="text-[#D65336] underline">grievance@restaurantos.com</a></p>
              <p><strong>Address:</strong> Spiral World, Technology Park, Hyderabad, Telangana, India</p>
            </div>
          </section>
        </div>
      </div>
    </PublicPageLayout>
  );
};

export default AccountDeletionPage;
