import { z } from "zod";

export const RegisterSchema = z.object({
  pseudo: z.string().min(3, "Le pseudo doit faire au moins 3 caractères."),
  email: z.string().email("Email invalide."),
  password: z
    .string()
    .min(8, "8 caractères minimum.")
    .regex(/[A-Z]/, "Une majuscule requise.")
    .regex(/[0-9]/, "Un chiffre requis.")
    .regex(/[^a-zA-Z0-9]/, "Un symbole requis."),
});

export const loginSchema = z.object({
  email: z.string().email("Email invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});
