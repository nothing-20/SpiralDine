import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import Card from '../../../components/ui/Card/Card';
import Badge from '../../../components/ui/Badge/Badge';
import Button from '../../../components/ui/Button/Button';
import { Award, Sparkles, Check, Info } from 'lucide-react';
import toast from 'react-hot-toast';

export const RewardsPage: React.FC = () => {
  const { user } = useAuth();
  const [points, setPoints] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    let unsub = () => {};

    const setupStream = async () => {
      let targetCollection = 'customers';
      try {
        const custSnap = await getDoc(doc(db, 'customers', user.uid));
        if (!custSnap.exists()) {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            targetCollection = 'users';
          }
        }
      } catch (_e) {
        targetCollection = 'customers';
      }

      const userDocRef = doc(db, targetCollection, user.uid);
      unsub = onSnapshot(userDocRef, (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setPoints(d.loyaltyPoints || 0);
        }
      }, () => setPoints(0));
    };

    setupStream();
    return () => unsub();
  }, [user?.uid]);

  const rewards = [
    { title: "Complimentary Gelato Dish", desc: "Redeemable with 250 points on next checkout.", cost: 250 },
    { title: "Free Bottle of Wine", desc: "Premium house white wine. Redeemable with 500 points.", cost: 500 },
    { title: "20% Total Check Discount", desc: "Apply 20% discount on order checks. Redeemable with 600 points.", cost: 600 }
  ];

  const handleRedeem = (cost: number, title: string) => {
    if (points >= cost) {
      setPoints(p => p - cost);
      toast.success(`Redeemed: ${title}! Reward coupon saved to profile.`, { icon: '🎁' });
    } else {
      toast.error('Insufficient loyalty points balance.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left select-none">
      
      <div className="space-y-1">
        <h2 className="text-xl font-display font-extrabold text-white">Loyalty & Rewards</h2>
        <p className="text-xs text-slate-400">Earn points for every dine-in checkout session and redeem coupons.</p>
      </div>

      {/* Glassmorphic digital points card mockup */}
      <div className="relative p-6 bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-primary/20 rounded-3xl overflow-hidden flex flex-col justify-between h-44 shadow-2xl shadow-primary/5">
        <div className="absolute right-[-10%] top-[-10%] w-24 h-24 bg-primary/25 rounded-full blur-2xl pointer-events-none" />
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest font-semibold">Spiral Dine VIP Club</span>
            <h4 className="text-sm font-extrabold text-white mt-0.5">
              {points > 500 ? 'Gold VIP Member' : points > 0 ? 'Member' : 'Verified Diner'}
            </h4>
          </div>
          <Award className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-1">
          <span className="text-[8.5px] text-slate-400 uppercase tracking-widest font-semibold">Points Ledger Balance</span>
          <h3 className="text-2xl font-display font-extrabold text-white">{points} Pts</h3>
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-t border-slate-855/40 pt-2.5">
          <span>{user?.displayName || user?.email?.split('@')[0] || 'Customer'}</span>
          <span>{points > 0 ? 'Active Points' : '0 Points'}</span>
        </div>
      </div>

      {/* Tiers overview progress */}
      <div className="p-5 bg-slate-900/40 border border-slate-900 rounded-2xl space-y-3">
        <h4 className="text-xs font-extrabold uppercase text-slate-450 tracking-wider">Tier Progression</h4>
        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
          <div className="bg-primary h-full rounded-full" style={{ width: '72%' }} />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-bold">
          <span>Bronze (0 Pts)</span>
          <span className="text-primary">Next Reward at 1000 Pts</span>
          <span>Gold (1200 Pts)</span>
        </div>
      </div>

      {/* Rewards Catalog */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Claimable Rewards</h3>
        
        <div className="space-y-3">
          {rewards.map((reward, i) => (
            <Card key={i} className="p-4 border-slate-850 bg-slate-900/30 rounded-2xl flex items-center justify-between gap-4">
              <div className="space-y-1 max-w-[320px]">
                <h4 className="text-xs font-extrabold text-slate-200">{reward.title}</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed font-semibold">{reward.desc}</p>
              </div>
              <button 
                onClick={() => handleRedeem(reward.cost, reward.title)}
                className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/25 text-primary text-[10px] font-bold rounded-xl transition-all whitespace-nowrap"
              >
                Claim {reward.cost} Pts
              </button>
            </Card>
          ))}
        </div>
      </div>

    </div>
  );
};

export default RewardsPage;
