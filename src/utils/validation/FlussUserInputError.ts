import { UserInputError } from "apollo-server-express";

// * Operation name | Mutations
export enum UserInputOperation {
  register = "REGISTER",
  login = "LOGIN",
  changePassword = "CHANGE_PASSWORD",
  changeUsername = "CHANGE_USERNAME",
  currentUser = "CURRENT_USER",
  forgotPassword = "FORGOT_PASSWORD",
}

// * Error names
export enum UserInputErrorCode {
  EmailExists = "EMAIL_EXISTS",
  UsernameExists = "USERNAME_EXISTS",
  UsernameTooShort = "USERNAME_TOO_SHORT",
  PasswordTooShort = "PASSWORD_TOO_SHORT",
  InvalidEmailOrUsername = "INVALID_EMAIL_OR_USERNAME",
  InvalidPassword = "INVALID_PASSWORD",
  InvalidUser = "INVALID_USER",
}

// * Which `Properties` per mutation -----
interface RegisterErrorProperties extends ErrorProperties {
  operation: UserInputOperation.register;
  flussError:
    | UserInputErrorCode.EmailExists
    | UserInputErrorCode.UsernameExists
    | UserInputErrorCode.UsernameTooShort
    | UserInputErrorCode.PasswordTooShort;
}

interface LoginErrorProperties extends ErrorProperties {
  operation: UserInputOperation.login;
  flussError:
    | UserInputErrorCode.InvalidEmailOrUsername
    | UserInputErrorCode.InvalidPassword;
}

interface ChagePasswordErrorProperties extends ErrorProperties {
  operation: UserInputOperation.changePassword;
  flussError:
    | UserInputErrorCode.InvalidUser
    | UserInputErrorCode.PasswordTooShort;
}
interface CurrentUserProperties extends ErrorProperties {
  operation: UserInputOperation.currentUser;
  flussError: UserInputErrorCode.InvalidUser;
}
interface ForgotPasswordProperties extends ErrorProperties {
  operation: UserInputOperation.forgotPassword;
  flussError: UserInputErrorCode.InvalidUser;
}

// * ----

interface ErrorProperties {
  operation: UserInputOperation;
  flussError: UserInputErrorCode;
}

export type UserInputErrorProperties =
  | RegisterErrorProperties
  | LoginErrorProperties
  | ChagePasswordErrorProperties
  | CurrentUserProperties
  | ForgotPasswordProperties;

export class FlussUserInputError extends UserInputError {
  constructor(message: string, properties: UserInputErrorProperties) {
    super(message, properties);
  }
}

// TODO: EXPORT THE ERRORS ALREADY CREATED TO BE EASIER TO CALL INSIDE THE RESOLVERS
