/**
 * Centralized Validation Schemas
 *
 * Provides Zod validation schemas for all forms in the application.
 * Eliminates 200+ lines of inline validation by centralizing all validation rules.
 *
 * **Benefits**:
 * - **DRY**: Single source of truth for validation rules
 * - **Type Safety**: Zod schemas generate TypeScript types automatically
 * - **Consistency**: Same validation rules across client and server
 * - **Maintainability**: Change validation in one place
 * - **Italian Error Messages**: User-friendly localized error messages
 *
 * **Integration with react-hook-form**:
 * ```typescript
 * import { zodResolver } from '@hookform/resolvers/zod';
 * import { LoginSchema } from '@/lib/validation/schemas';
 *
 * const { register, handleSubmit, formState: { errors } } = useForm({
 *   resolver: zodResolver(LoginSchema),
 * });
 * ```
 *
 * @module lib/validation/schemas
 */

import { z } from 'zod';

/**
 * Username validation schema
 *
 * **Rules**:
 * - Minimum 3 characters
 * - Maximum 20 characters
 * - Only alphanumeric characters, underscores, and hyphens
 * - Cannot start or end with underscore/hyphen
 *
 * @constant
 * @type {z.ZodString}
 *
 * @example
 * ```typescript
 * const result = UsernameSchema.safeParse('john_doe');
 * if (result.success) {
 *   console.log('Valid username:', result.data);
 * }
 * ```
 */
export const UsernameSchema = z
  .string()
  .min(3, { message: 'Username deve essere di almeno 3 caratteri' })
  .max(20, { message: 'Username non può superare 20 caratteri' })
  .regex(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username può contenere solo lettere, numeri, underscore e trattini',
  })
  .regex(/^[a-zA-Z0-9]/, {
    message: 'Username non può iniziare con underscore o trattino',
  })
  .regex(/[a-zA-Z0-9]$/, {
    message: 'Username non può terminare con underscore o trattino',
  });

/**
 * Email validation schema
 *
 * **Rules**:
 * - Must be a valid email format
 * - Maximum 100 characters
 * - Case-insensitive
 *
 * @constant
 * @type {z.ZodString}
 *
 * @example
 * ```typescript
 * const result = EmailSchema.safeParse('user@example.com');
 * if (result.success) {
 *   console.log('Valid email:', result.data);
 * }
 * ```
 */
export const EmailSchema = z
  .string()
  .min(1, { message: 'Email è obbligatoria' })
  .email({ message: 'Email non valida' })
  .max(100, { message: 'Email troppo lunga' })
  .toLowerCase();

/**
 * Password validation schema
 *
 * **Security Requirements**:
 * - Minimum 8 characters
 * - At least one letter (a-z, A-Z)
 * - At least one number (0-9)
 * - Special characters are optional but allowed
 *
 * @constant
 * @type {z.ZodString}
 *
 * @example
 * ```typescript
 * const result = PasswordSchema.safeParse('MyPassword123');
 * if (!result.success) {
 *   console.error('Password errors:', result.error.errors);
 * }
 * ```
 */
export const PasswordSchema = z
  .string()
  .min(8, { message: 'Password deve essere di almeno 8 caratteri' })
  .regex(/[a-zA-Z]/, { message: 'Password deve contenere almeno una lettera' })
  .regex(/[0-9]/, { message: 'Password deve contenere almeno un numero' });

/**
 * Login form validation schema
 *
 * **Fields**:
 * - username: 3-20 characters, alphanumeric + underscore/hyphen
 * - password: At least 1 character (full validation only on registration)
 * - rememberMe: Optional boolean for session persistence
 *
 * @constant
 * @type {z.ZodObject}
 *
 * @example
 * ```typescript
 * import { zodResolver } from '@hookform/resolvers/zod';
 *
 * const { register, handleSubmit } = useForm({
 *   resolver: zodResolver(LoginSchema),
 * });
 *
 * const onSubmit = (data) => {
 *   // data is type-safe: { username: string, password: string, rememberMe?: boolean }
 *   console.log(data);
 * };
 * ```
 */
export const LoginSchema = z.object({
  username: UsernameSchema,
  password: z.string().min(1, { message: 'Password è obbligatoria' }),
  rememberMe: z.boolean().optional(),
});

/**
 * Registration form validation schema
 *
 * **Fields**:
 * - username: Full username validation
 * - email: Valid email address
 * - password: Full security requirements
 * - confirmPassword: Must match password
 * - agreeToTerms: Must be explicitly true
 *
 * **Cross-Field Validation**:
 * - Ensures password and confirmPassword match
 * - Ensures user explicitly agrees to terms (not just checked by default)
 *
 * @constant
 * @type {z.ZodObject}
 *
 * @example
 * ```typescript
 * const { register, handleSubmit, formState: { errors } } = useForm({
 *   resolver: zodResolver(RegisterSchema),
 * });
 *
 * // Access field-level errors
 * {errors.username?.message}
 * {errors.confirmPassword?.message}
 * ```
 */
export const RegisterSchema = z
  .object({
    username: UsernameSchema,
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string().min(1, { message: 'Conferma password è obbligatoria' }),
    agreeToTerms: z.boolean().refine(val => val === true, {
      message: 'Devi accettare i termini e condizioni',
    }),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Le password non coincidono',
    path: ['confirmPassword'],
  });

/**
 * Character creation form validation schema
 *
 * **Required Fields**:
 * - name: 2-50 characters
 *
 * **Optional Fields**:
 * - occupation: UUID of predefined occupation
 * - currentOccupation: Free-text occupation (if not using predefined)
 * - age: 16-80 years (Victorian era realistic range)
 * - description: Physical/personality description (50-500 characters if provided)
 * - background: Character backstory (max 1000 characters)
 *
 * **Business Rules**:
 * - Either occupation OR currentOccupation must be provided (not both)
 * - Description must be meaningful (50+ chars) if provided
 *
 * @constant
 * @type {z.ZodObject}
 *
 * @example
 * ```typescript
 * const { register, handleSubmit, formState: { errors } } = useForm({
 *   resolver: zodResolver(CharacterCreationSchema),
 * });
 *
 * // Optional fields validation
 * {errors.age?.message}
 * {errors.description?.message}
 * ```
 */
export const CharacterCreationSchema = z
  .object({
    name: z
      .string()
      .min(2, { message: 'Nome deve essere di almeno 2 caratteri' })
      .max(50, { message: 'Nome non può superare 50 caratteri' })
      .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, {
        message: "Nome può contenere solo lettere, spazi, apostrofi e trattini",
      }),
    occupation: z.string().uuid({ message: 'Occupazione non valida' }).optional(),
    currentOccupation: z
      .string()
      .min(2, { message: 'Occupazione deve essere di almeno 2 caratteri' })
      .max(100, { message: 'Occupazione non può superare 100 caratteri' })
      .optional(),
    age: z
      .number({ message: 'Età deve essere un numero' })
      .int({ message: 'Età deve essere un numero intero' })
      .min(16, { message: 'Età minima: 16 anni' })
      .max(80, { message: 'Età massima: 80 anni' })
      .optional(),
    description: z
      .string()
      .min(50, { message: 'Descrizione deve essere di almeno 50 caratteri' })
      .max(500, { message: 'Descrizione non può superare 500 caratteri' })
      .optional()
      .or(z.literal('')), // Allow empty string to skip validation
    background: z
      .string()
      .max(1000, { message: 'Background non può superare 1000 caratteri' })
      .optional(),
  })
  .refine(data => data.occupation || data.currentOccupation, {
    message: 'Devi selezionare o inserire una occupazione',
    path: ['currentOccupation'],
  });

/**
 * Forgot password form validation schema
 *
 * **Fields**:
 * - identifier: Username or email address
 *
 * @constant
 * @type {z.ZodObject}
 *
 * @example
 * ```typescript
 * const { register, handleSubmit } = useForm({
 *   resolver: zodResolver(ForgotPasswordSchema),
 * });
 * ```
 */
export const ForgotPasswordSchema = z.object({
  identifier: z
    .string()
    .min(3, { message: 'Username o email deve essere di almeno 3 caratteri' })
    .max(50, { message: 'Username o email troppo lungo' }),
});

/**
 * Reset password form validation schema
 *
 * **Fields**:
 * - password: Full security requirements
 * - confirmPassword: Must match password
 *
 * **Cross-Field Validation**:
 * - Ensures password and confirmPassword match
 *
 * @constant
 * @type {z.ZodObject}
 *
 * @example
 * ```typescript
 * const { register, handleSubmit } = useForm({
 *   resolver: zodResolver(ResetPasswordSchema),
 * });
 * ```
 */
export const ResetPasswordSchema = z
  .object({
    password: PasswordSchema,
    confirmPassword: z.string().min(1, { message: 'Conferma password è obbligatoria' }),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Le password non coincidono',
    path: ['confirmPassword'],
  });

/**
 * Delete account confirmation form validation schema
 *
 * **Fields**:
 * - confirmationText: Must exactly match "ELIMINA IL MIO ACCOUNT" (case-sensitive)
 *
 * **Purpose**:
 * Forces user to type the exact phrase to prevent accidental account deletion.
 * This is a common UX pattern for destructive actions.
 *
 * @constant
 * @type {z.ZodObject}
 *
 * @example
 * ```typescript
 * const { register, handleSubmit, formState: { errors } } = useForm({
 *   resolver: zodResolver(DeleteAccountSchema),
 * });
 *
 * // Error if user types anything other than exact phrase
 * {errors.confirmationText?.message}
 * ```
 */
export const DeleteAccountSchema = z.object({
  confirmationText: z
    .string()
    .refine(val => val === 'ELIMINA IL MIO ACCOUNT', {
      message: 'Devi digitare esattamente "ELIMINA IL MIO ACCOUNT"',
    }),
});

/**
 * Type inference helpers
 *
 * Automatically infer TypeScript types from Zod schemas.
 * Use these types for form data, function parameters, etc.
 *
 * @example
 * ```typescript
 * import type { LoginFormData, RegisterFormData } from '@/lib/validation/schemas';
 *
 * function handleLogin(data: LoginFormData) {
 *   // data is type-safe with all fields
 *   console.log(data.username, data.password, data.rememberMe);
 * }
 * ```
 */
export type LoginFormData = z.infer<typeof LoginSchema>;
export type RegisterFormData = z.infer<typeof RegisterSchema>;
export type CharacterCreationFormData = z.infer<typeof CharacterCreationSchema>;
export type ForgotPasswordFormData = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordFormData = z.infer<typeof ResetPasswordSchema>;
export type DeleteAccountFormData = z.infer<typeof DeleteAccountSchema>;
