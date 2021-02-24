import { MyContext } from "src/types";
import { AuthenticationError } from "apollo-server-express";
import { MiddlewareFn } from "type-graphql";

export const isLoggedIn: MiddlewareFn<MyContext> = async (
  { context },
  next
) => {
  if (!context.req.session.userId) {
    throw new AuthenticationError("Not authenticated.");
  }

  return next();
};

export default isLoggedIn;
