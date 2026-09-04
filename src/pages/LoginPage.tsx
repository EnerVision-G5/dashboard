/**
 * Écran de connexion (EV-48), repris sur le design system (EV-47).
 *
 * Un `<form>` natif, pas une pile de `<div>` : la soumission au clavier et
 * l'annonce des erreurs par les lecteurs d'écran fonctionnent alors sans code
 * supplémentaire.
 *
 * La validation est faite ici plutôt que laissée au navigateur seul : le
 * message natif de `required` n'est ni testable ni traduit de façon homogène
 * d'un navigateur à l'autre. D'où le `noValidate`, qui laisse la main au
 * composant tout en gardant l'obligation annoncée aux technologies
 * d'assistance.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../auth/useAuth";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { ErrorState } from "../ui/states";

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
    <div className="flex min-h-screen items-center justify-center bg-ardoise-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-ardoise-900">Smart Energy Optimiser</h1>
          <p className="mt-1 text-corps text-ardoise-600">
            Connexion requise pour consulter la supervision des sites.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          noValidate
          className="flex flex-col gap-4 rounded-surface border border-ardoise-200 bg-white p-6 shadow-surface"
        >
          {error !== null && <ErrorState title="Connexion refusée">{error}</ErrorState>}

          <TextField
            label="Identifiant"
            name="username"
            type="text"
            autoComplete="username"
            autoFocus
            required
            value={username}
            error={fieldErrors.username}
            onChange={(event) => {
              setUsername(event.target.value);
            }}
          />

          <TextField
            label="Mot de passe"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            error={fieldErrors.password}
            onChange={(event) => {
              setPassword(event.target.value);
            }}
          />

          <Button type="submit" fullWidth isLoading={isSigningIn} loadingLabel="Connexion en cours…">
            Se connecter
          </Button>
        </form>
      </div>
    </div>
  );
}
