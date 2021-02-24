import { ApolloError } from "apollo-server-express";

export enum FlussErrorCode {
  somethingWentWrong = "SOMETHING_WENT_WRONG",
}

export class FlussError extends ApolloError {
  constructor(message: string, flussError?: FlussErrorCode) {
    super(message, flussError);
    this.flussError = FlussErrorCode.somethingWentWrong;
  }
}
