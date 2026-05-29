import React from 'react';
import { useAuth } from '../lib/auth';
import { User } from 'lucide-react';
import DefaultSignatureCard from '../components/DefaultSignatureCard';
import MobileNotificationsCard from '../components/MobileNotificationsCard';

/**
 * Per-user profile page. Accessible to every signed-in role (admin / staff /
 * engineer) so site engineers can pre-fit their signature and enable mobile
 * push notifications without needing admin access.
 */
const ProfilePage = () => {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="profile-page">
      <h1 className="font-head text-3xl md:text-4xl font-extrabold mb-1 flex items-center gap-2"
          style={{ color: 'var(--cc-dark-green)' }}>
        <User size={26}/> My Profile
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--cc-text-muted)' }}>
        Signed in as <strong>{user?.username || ''}</strong>
        {user?.role ? <> · <span className="font-mono-data">{user.role}</span></> : null}
      </p>

      <DefaultSignatureCard />
      <MobileNotificationsCard />
    </div>
  );
};

export default ProfilePage;
