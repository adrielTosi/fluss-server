import { MyContext } from "src/types";
import { MiddlewareFn } from "type-graphql";

export const isLoggedIn: MiddlewareFn<MyContext> = async (
  { context },
  next
) => {
  if (!context.req.session.userId) {
    throw new Error("Not authenticated.");
  }

  return next();
};

export default isLoggedIn;
