import { Compass } from 'lucide-react';
import { href } from '../app/router';
import { LinkButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/Feedback';

export function NotFoundPage({ message = 'Cette page n’existe pas.' }: { message?: string }) {
  return (
    <EmptyState
      icon={<Compass className="size-7" />}
      title="Page introuvable"
      description={message}
      action={
        <LinkButton variant="primary" href={href({ name: 'home' })}>
          Retour à l’accueil
        </LinkButton>
      }
    />
  );
}
