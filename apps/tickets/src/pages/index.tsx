import { useRouter } from 'next/router';
import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';
import Link from 'next/link';

export default function TicketsHomePage() {
  const { authContext } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authContext.isLoading && !authContext.user) {
      window.location.href = 'https://tenpennynovels.com';
    }
  }, [authContext.user, authContext.isLoading]);

  if (authContext.isLoading) {
    return (
      <div className={"loading"}>
        <div className={"loadingText"}>Caricamento...</div>
      </div>
    );
  }

  if (!authContext.user) {
    return null;
  }

  const isStaffMember = authContext.character?.gameplayRoles?.some(role => 
    ['master', 'moderatore', 'amministratore'].includes(role)
  );

  return (
    <div className={"pageContainer"}>
      <div className={"contentWrapper"}>
        <div className={"mainCard"}>
          <div className={"header"}>
            <h1>Sistema Ticket TenpennyNovels</h1>
            <p>Gestione completa dei ticket di supporto</p>
          </div>

          <div className={"cardGrid"}>
            <Link href="/tickets/my-tickets">
              <div className={"ticketCard"}>
                <div className={"cardHeader"}>
                  <div className={`${"cardIcon"} ${"myTickets"}`}>
                    <span>📝</span>
                  </div>
                  <h3>I Miei Ticket</h3>
                </div>
                <p className={"cardDescription"}>
                  Visualizza e gestisci i ticket che hai creato
                </p>
              </div>
            </Link>

            {isStaffMember && (
              <>
                <Link href="/tickets/department-tickets">
                  <div className={"ticketCard"}>
                    <div className={"cardHeader"}>
                      <div className={`${"cardIcon"} ${"departmentTickets"}`}>
                        <span>🏢</span>
                      </div>
                      <h3>Ticket Dipartimento</h3>
                    </div>
                    <p className={"cardDescription"}>
                      Gestisci i ticket assegnati al tuo dipartimento
                    </p>
                  </div>
                </Link>

                <Link href="/tickets/all-tickets">
                  <div className={"ticketCard"}>
                    <div className={"cardHeader"}>
                      <div className={`${"cardIcon"} ${"allTickets"}`}>
                        <span>📋</span>
                      </div>
                      <h3>Tutti i Ticket</h3>
                    </div>
                    <p className={"cardDescription"}>
                      Vista completa di tutti i ticket del sistema
                    </p>
                  </div>
                </Link>
              </>
            )}
          </div>

          {authContext.character && (
            <div className={"userFooter"}>
              <div className={"userInfo"}>
                <span className={"label"}>Accesso come:</span>
                <span className={"userName"}>
                  {authContext.character.name} {authContext.character.surname}
                </span>
                {authContext.character.gameplayRoles && authContext.character.gameplayRoles.length > 0 && (
                  <span className={"userRoles"}>
                    {authContext.character.gameplayRoles.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

