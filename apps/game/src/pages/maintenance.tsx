import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

interface MaintenanceInfo {
  message: string;
  estimatedCompletion: string | null;
}

export default function MaintenancePage() {
  const router = useRouter();
  const [info, setInfo] = useState<MaintenanceInfo>({
    message: 'Il sistema è in manutenzione. Riprova più tardi.',
    estimatedCompletion: null,
  });

  useEffect(() => {
    // Try to fetch maintenance info from query params (passed by error handler)
    if (router.query.message) {
      setInfo({
        message: router.query.message as string,
        estimatedCompletion: router.query.estimatedCompletion as string || null,
      });
    }

    // Check every 60 seconds if maintenance is over
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          // Maintenance is over, redirect to home
          window.location.href = '/';
        }
      } catch {
        // Still in maintenance
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [router.query]);

  return (
    <>
      <Head>
        <title>Manutenzione | Ten Penny Novels</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
        <div className="max-w-md w-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-8 text-center">
          {/* Icon */}
          <div className="mb-6">
            <svg
              className="w-20 h-20 mx-auto text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-4">
            Manutenzione in Corso
          </h1>

          {/* Message */}
          <p className="text-gray-300 mb-6 leading-relaxed">
            {info.message}
          </p>

          {/* Estimated completion */}
          {info.estimatedCompletion && (
            <div className="bg-gray-700/50 rounded-md p-4 mb-6">
              <p className="text-sm text-gray-400 mb-1">
                Termine stimato
              </p>
              <p className="text-lg text-amber-400 font-semibold">
                {new Date(info.estimatedCompletion).toLocaleString('it-IT', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>
          )}

          {/* Status indicator */}
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span>Controllo automatico ogni minuto...</span>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              Ten Penny Novels &copy; {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
