import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

export const useShowTimer = () => {
  const router = useRouter();
  const [isActive, setIsActive] = useState<boolean>(false);
  const [timer, setTimer] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const savedData = localStorage.getItem('showTimerData');
    if (savedData) {
      const data = JSON.parse(savedData);
      setTimer(data.timer);
      if (data.isActive) {
        setIsActive(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      const startInterval = () => {
        const interval = window.setInterval(() => {
          setTimer((prevTime) => prevTime + 1);
        }, 1000);
        intervalRef.current = interval;
      };

      startInterval();
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      saveData(false); // Salva quando pausa
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  const saveData = (activeStatus: boolean) => {
    const data = {
      timer: timer,
      isActive: activeStatus
    };
    localStorage.setItem('showTimerData', JSON.stringify(data));
  };

  const start = () => {
    if (!isActive) {
      setIsActive(true);
      saveData(true);
    }
  };

  const pause = () => {
    if (isActive) {
      setIsActive(false);
      saveData(false)
    }
  };

  const stop = () => {
    setIsActive(false);
    setTimer(0);
    localStorage.removeItem('showTimerData');
  };

  // Salvar dados quando o usuário muda de rota ou sai da página
  useEffect(() => {
    const handleRouteChangeOrUnload = () => {
      saveData(isActive);
    };

    router.events.on('routeChangeStart', handleRouteChangeOrUnload);
    window.addEventListener('beforeunload', handleRouteChangeOrUnload);

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeOrUnload);
      window.removeEventListener('beforeunload', handleRouteChangeOrUnload);
    };
  }, [router, timer, isActive]);

  return { timer, start, pause, stop, isActive };
};