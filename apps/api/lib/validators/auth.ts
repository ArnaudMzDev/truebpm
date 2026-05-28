import { z } from "zod";

export const PasswordSchema = z
  .string()
  .min(8, "8 caractères minimum.")
  .max(128, "Mot de passe trop long.")
  .regex(/[A-Z]/, "Une majuscule requise.")
  .regex(/[0-9]/, "Un chiffre requis.")
  .regex(/[^a-zA-Z0-9]/, "Un symbole requis.");

export const RegisterSchema = z.object({
  pseudo: z.string().trim().min(3, "Le pseudo doit faire au moins 3 caractères.").max(30, "Pseudo trop long."),
  email: z.string().email("Email invalide."),
  password: PasswordSchema,
  legalAccepted: z.literal(true, {
    errorMap: () => ({ message: "Tu dois accepter les conditions d'utilisation." }),
  }),
  termsVersion: z.string().trim().max(32).optional(),
  privacyVersion: z.string().trim().max(32).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Email invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});
