/**
 * Écran de connexion (EV-48).
 *
 * Un `<form>` natif, pas une pile de `<div>` : la validation des champs
 * obligatoires, la soumission au clavier et l'annonce des erreurs par les
 * lecteurs d'écran fonctionnent alors sans code supplémentaire.
 *
 * La validation est faite ici plutôt que laissée au navigateur seul : le
 * message natif de `required` n'est pas lisible par un test, ni traduit de
 * façon homogène d'un navigateur à l'autre.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/useAuth";

/** Identifiants des champs, partagés avec leurs `<label>`. */
export const USERNAME_FIELD_ID = "login-username";
export const PASSWORD_FIELD_ID = "login-password";

/** Message affiché sous un champ obligatoire laissé vide. */
export const REQUIRED_FIELD_MESSAGE = "Ce champ est obligatoire.";

interface FieldErrors {
  username?: string;
  password?: string;
}

function validate(username: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (username.trim() === "") {
    errors.username = REQUIRED_FIELD_MESSAGE;
  }
  if (password === "") {
    errors.password = REQUIRED_FIELD_MESSAGE;
  }
  return errors;
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (message === undefined) {
    return null;
  }
  return (
    <p id={id} className="text-sm text-red-700">
      {message}
    </p>
  );
}

export function LoginPage() {
  const { signIn, isSigningIn, error } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const found = validate(username, password);
    setFieldErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    // La redirection n'est pas déclenchée ici : ouvrir la session suffit, le
    // routeur suit l'état d'authentification. Un seul endroit décide de la
    // navigation, ce qui évite deux vérités contradictoires.
    const succeeded = await signIn(username, password);
    if (succeeded) {
      // Le mot de passe ne survit pas à la connexion réussie.
      setPassword("");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Smart Energy Optimiser</h1>
          <p className="mt-1 text-sm text-slate-600">
            Connexion requise pour consulter la supervision des sites.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          noValidate
          className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          {error !== null && (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <label htmlFor={USERNAME_FIELD_ID} className="text-sm font-medium text-slate-700">
              Identifiant
            </label>
            <input
              id={USERNAME_FIELD_ID}
              name="username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
              }}
              aria-invalid={fieldErrors.username !== undefined}
              aria-describedby={
                fieldErrors.username === undefined ? undefined : `${USERNAME_FIELD_ID}-error`
              }
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-teal-700 focus:ring-2 focus:ring-teal-700 focus:outline-none"
            />
            <FieldError id={`${USERNAME_FIELD_ID}-error`} message={fieldErrors.username} />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={PASSWORD_FIELD_ID} className="text-sm font-medium text-slate-700">
              Mot de passe
            </label>
            <input
              id={PASSWORD_FIELD_ID}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              aria-invalid={fieldErrors.password !== undefined}
              aria-describedby={
                fieldErrors.password === undefined ? undefined : `${PASSWORD_FIELD_ID}-error`
              }
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-teal-700 focus:ring-2 focus:ring-teal-700 focus:outline-none"
            />
            <FieldError id={`${PASSWORD_FIELD_ID}-error`} message={fieldErrors.password} />
          </div>

          <button
            type="submit"
            disabled={isSigningIn}
            className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white shadow-sm hover:bg-teal-800 focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 focus:outline-none disabled:bg-slate-400"
          >
            {isSigningIn ? "Connexion en cours…" : "Se connecter"}
          </button>

          {/* aria-live plutôt qu'un role="status" permanent : l'état de
              chargement n'est annoncé qu'au moment où il apparaît. */}
          <p aria-live="polite" className="sr-only">
            {isSigningIn ? "Connexion en cours" : ""}
          </p>
        </form>
      </div>
    </div>
  );
}
