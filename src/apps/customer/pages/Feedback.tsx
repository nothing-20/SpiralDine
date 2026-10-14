import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../context/AuthContext';
import { PostDiningFeedbackView } from '../components/reviews/PostDiningFeedbackView';
import LoadingSpinner from '../../../components/ui/LoadingSpinner/LoadingSpinner';

export const Feedback: React.FC = () => {
  const { tenantId: routeTenantId } = useParams<{ tenantId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const queryTenantId = searchParams.get('tenantId') || searchParams.get('restaurantId');
  const orderId = searchParams.get('orderId') || 'ORD-DIRECT-REVIEW';
  const effectiveTenantId = routeTenantId || queryTenantId || 'bawarchi-restaurant';

  const [restaurantName, setRestaurantName] = useState<string>('Restaurant');
  const [restaurantImage, setRestaurantImage] = useState<string | undefined>(undefined);
  const [tableNumber, setTableNumber] = useState<string | undefined>(undefined);
  const [orderDate, setOrderDate] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const fetchDetails = async () => {
      if (!effectiveTenantId) {
        setIsLoading(false);
        return;
      }

      try {
        // Fetch restaurant name and image
        let tDoc = await getDoc(doc(db, 'tenants', effectiveTenantId));
        if (!tDoc.exists()) {
          tDoc = await getDoc(doc(db, 'restaurants', effectiveTenantId));
        }

        if (tDoc.exists() && isMounted) {
          const tData = tDoc.data();
          setRestaurantName(tData.restaurantName || tData.name || 'Restaurant');
          setRestaurantImage(tData.coverImageUrl || tData.coverImage || tData.logoUrl || undefined);
        }

        // Check if an order document exists for this orderId
        if (orderId && orderId !== 'ORD-DIRECT-REVIEW') {
          const oDoc = await getDoc(doc(db, 'restaurants', effectiveTenantId, 'orders', orderId));
          if (oDoc.exists() && isMounted) {
            const oData = oDoc.data();
            setTableNumber(oData.tableNumber || undefined);
            if (oData.createdAt) {
              try {
                const d = new Date(oData.createdAt);
                setOrderDate(d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }));
              } catch (_) {}
            }
          }
        }
      } catch (err) {
        console.warn('[FeedbackPage] Details fetch warning:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [effectiveTenantId, orderId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FCFAF7] flex flex-col items-center justify-center p-6">
        <LoadingSpinner label="Loading dining feedback..." />
      </div>
    );
  }

  return (
    <PostDiningFeedbackView
      tenantId={effectiveTenantId}
      orderId={orderId}
      restaurantName={restaurantName}
      restaurantImage={restaurantImage}
      orderDate={orderDate}
      tableNumber={tableNumber}
      customerName={user?.displayName || undefined}
      customerId={user?.uid || undefined}
      onSkipReceipt={() => {
        if (orderId && orderId !== 'ORD-DIRECT-REVIEW') {
          navigate(`/customer/restaurant/${effectiveTenantId}/order/${orderId}?view=receipt`);
        } else {
          navigate(`/customer/restaurant/${effectiveTenantId}`);
        }
      }}
      onFinishHome={() => navigate('/customer/home')}
    />
  );
};

export default Feedback;
