import { UserInputError } from "apollo-server-express";

// * Operation name | Mutations
export enum UserInputOperation {
  register = "REGISTER",
  login = "LOGIN",
  changePassword = "CHANGE_PASSWORD",
  changeUsername = "CHANGE_USERNAME",
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
  | ChagePasswordErrorProperties;

export class FlussUserInputError extends UserInputError {
  constructor(message: string, properties: UserInputErrorProperties) {
    super(message, properties);
    Object.defineProperty(this, "name", { value: "FlussUserInputError" });
  }
}

// TODO: EXPORT THE ERRORS ALREADY CREATED TO BE EASIER TO CALL INSIDE THE RESOLVERS
