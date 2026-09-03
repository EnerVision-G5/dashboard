/**
 * Champs de saisie du design system (EV-47).
 *
 * Anatomie commune en cinq parties, dont deux facultatives : étiquette, champ,
 * texte d'aide, message d'erreur, marque d'obligation.
 *
 * Deux règles portées par le composant plutôt que laissées à l'appelant :
 *
 *   - l'étiquette est toujours rendue et toujours liée par `htmlFor`. Jamais de
 *     placeholder en guise d'étiquette : il disparaît à la saisie, exactement
 *     quand l'utilisateur en a besoin ;
 *   - l'erreur est portée par `aria-invalid` et `aria-describedby`, pas
 *     seulement par une bordure rouge — la couleur ne porte jamais seule.
 *
 * Les éléments sont natifs (`input`, `select`) : le clavier, le focus et les
 * lecteurs d'écran fonctionnent alors sans une ligne de code de plus.
 */

import { useId } from "react";
import type { ComponentProps, ReactNode } from "react";

const CONTROL = [
  "w-full rounded-controle border bg-white px-3 py-2 text-corps text-ardoise-900",
  "shadow-surface transition-colors duration-150 ease-etat",
  "disabled:cursor-not-allowed disabled:bg-ardoise-100 disabled:text-ardoise-500",
].join(" ");

const BORDER_OK = "border-ardoise-300";
const BORDER_ERREUR = "border-alerte-700";

interface ShellProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (aria: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Étiquette, aide et erreur autour d'un contrôle natif. */
function FieldShell({ id, label, hint, error, required = false, children }: ShellProps) {
  const hintId = `${id}-aide`;
  const errorId = `${id}-erreur`;
  const describedBy =
    [error !== undefined ? errorId : null, hint !== undefined ? hintId : null]
      .filter((value) => value !== null)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-corps font-medium text-ardoise-700">
        {label}
        {required && (
          <>
            {" "}
            <span className="text-alerte-700" aria-hidden>
              *
            </span>
            <span className="sr-only">(obligatoire)</span>
          </>
        )}
      </label>

      {children({ id, describedBy, invalid: error !== undefined })}

      {hint !== undefined && (
        <p id={hintId} className="text-annexe text-ardoise-600">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} className="text-corps text-alerte-700">
          {error}
        </p>
      )}
    </div>
  );
}

type NativeInput = Omit<
  ComponentProps<"input">,
  "id" | "className" | "aria-invalid" | "aria-describedby"
>;

interface TextFieldProps extends NativeInput {
  label: string;
  hint?: string;
  error?: string;
}

/** Champ texte : identifiant, mot de passe, recherche. */
export function TextField({ label, hint, error, required, ...rest }: TextFieldProps) {
  const generated = useId();

  return (
    <FieldShell id={generated} label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          // `noValidate` est posé sur le formulaire : la validation est faite en
          // TypeScript, testable et traduite de façon homogène. `required` reste
          // annoncé aux technologies d'assistance.
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`${CONTROL} ${invalid ? BORDER_ERREUR : BORDER_OK}`}
          {...rest}
        />
      )}
    </FieldShell>
  );
}

/** Une option de liste déroulante. */
export interface SelectOption {
  value: string;
  label: string;
}

type NativeSelect = Omit<
  ComponentProps<"select">,
  "id" | "className" | "children" | "aria-invalid" | "aria-describedby"
>;

interface SelectFieldProps extends NativeSelect {
  label: string;
  options: readonly SelectOption[];
  hint?: string;
  error?: string;
  /** Option affichée quand la liste est vide ou en cours de chargement. */
  placeholder?: string;
}

/** Liste déroulante native. */
export function SelectField({
  label,
  options,
  hint,
  error,
  placeholder,
  required,
  ...rest
}: SelectFieldProps) {
  const generated = useId();

  return (
    <FieldShell id={generated} label={label} hint={hint} error={error} required={required}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={`${CONTROL} ${invalid ? BORDER_ERREUR : BORDER_OK}`}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}
