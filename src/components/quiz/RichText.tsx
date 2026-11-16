import { Fragment } from 'react';

/**
 * Affiche un texte en interprétant uniquement les portions entre accents graves
 * (`code`) comme du code. Aucun HTML n'est interprété : le texte reste sûr.
 */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.length > 2 && part.startsWith('`') && part.endsWith('`') ? (
          <code key={i}>{part.slice(1, -1)}</code>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
