import { useEffect, useState, type FormEvent } from 'react';
import { useToast } from '../../app/toast';
import { db } from '../../db/database';
import { createSubject, updateSubject } from '../../db/repository';
import { useSubjects } from '../../hooks/useData';
import { errorMessage, ValidationError } from '../../lib/errors';
import type { Subject } from '../../models/types';
import { Button } from '../ui/Button';
import { Field, TextArea, TextInput } from '../ui/Field';
import { Modal } from '../ui/Modal';

export interface SubjectFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Sujet à modifier ; absent = création. */
  subject?: Subject;
  onSaved?: (subject: Subject) => void;
}

/** Création ou modification d'un sujet (titre, description, catégorie). */
export function SubjectFormModal({ open, onClose, subject, onSaved }: SubjectFormModalProps) {
  const notify = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const subjects = useSubjects();
  const categories = [...new Set((subjects ?? []).map((s) => s.category).filter((c): c is string => !!c))].sort((a, b) =>
    a.localeCompare(b, 'fr'),
  );

  useEffect(() => {
    if (!open) return;
    setTitle(subject?.title ?? '');
    setDescription(subject?.description ?? '');
    setCategory(subject?.category ?? '');
    setErrors({});
  }, [open, subject]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const input = { title, description, category };
      const saved = subject ? await updateSubject(db, subject.id, input) : await createSubject(db, input);
      notify(subject ? 'Sujet mis à jour.' : `Sujet « ${saved.title} » créé.`);
      onClose();
      onSaved?.(saved);
    } catch (err) {
      if (err instanceof ValidationError) {
        const map: Record<string, string> = {};
        for (const issue of err.issues) {
          const key = issue.path.includes('titre') ? 'title' : issue.path.includes('description') ? 'description' : 'category';
          map[key] ??= issue.message;
        }
        setErrors(map);
      } else {
        notify(errorMessage(err), 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  const formId = 'subject-form';
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={subject ? 'Modifier le sujet' : 'Créer un sujet'}
      description={subject ? undefined : 'Un sujet regroupe une banque de questions sur un même thème.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {subject ? 'Enregistrer' : 'Créer le sujet'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Titre" required error={errors.title}>
          {(p) => (
            <TextInput
              {...p}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. : Anatomie du cœur, JavaScript avancé…"
              maxLength={120}
              autoFocus
              invalid={!!errors.title}
            />
          )}
        </Field>
        <Field label="Description" hint="Facultative. Quelques mots pour décrire le contenu du sujet." error={errors.description}>
          {(p) => <TextArea {...p} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} rows={3} />}
        </Field>
        <Field label="Catégorie" hint="Facultative. Ex. : Langues, Médecine, Programmation…" error={errors.category}>
          {(p) => <TextInput {...p} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} list="quizlab-categories" />}
        </Field>
        <datalist id="quizlab-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </form>
    </Modal>
  );
}
