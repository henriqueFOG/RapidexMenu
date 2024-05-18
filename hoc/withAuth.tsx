import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';

const withAuth = <P extends object>(WrappedComponent: React.ComponentType<P>) => {
  const ComponentWithAuth = (props: P) => {
    const { isAuthenticated } = useAuth();
    const router = useRouter();
    const { clientId } = router.query;

    React.useEffect(() => {
      if (!isAuthenticated) {
        router.push(`/clients/${clientId}/admin/login`);
      }
    }, [isAuthenticated, router, clientId]);

    if (!isAuthenticated) {
      return null; // or a loading spinner
    }

    return <WrappedComponent {...props} />;
  };

  // Set the display name for better debugging
  ComponentWithAuth.displayName = `WithAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return ComponentWithAuth;
};

export default withAuth;
