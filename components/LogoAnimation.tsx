import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';

// Importação dinâmica do Lottie sem SSR
const Lottie = dynamic(() => import('react-lottie'), { ssr: false });

interface LogoAnimationProps {
  width?: number;
  height?: number;
  loop?: boolean;
  autoplay?: boolean;
  path: string; // Caminho para o arquivo JSON
  clientId: string | string[] | undefined; // ID do cliente para o redirecionamento
}

const LogoAnimation: React.FC<LogoAnimationProps> = ({ width = 400, height = 400, loop = false, autoplay = true, path, clientId }) => {
  const [animationData, setAnimationData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchAnimationData = async () => {
      const response = await fetch(path);
      const data = await response.json();
      setAnimationData(data);
    };

    fetchAnimationData();
  }, [path]);

  const handleComplete = () => {
    router.push(`/clients/${clientId}/login`);
  };

  const defaultOptions = {
    loop,
    autoplay,
    animationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  };

  return (
    <Lottie
      options={defaultOptions}
      height={height}
      width={width}
      eventListeners={[
        {
          eventName: 'complete',
          callback: handleComplete,
        },
      ]}
    />
  );
};

export default LogoAnimation;
