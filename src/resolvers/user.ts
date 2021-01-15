import {
  Mutation,
  Arg,
  Resolver,
  InputType,
  Field,
  Ctx,
  ObjectType,
  Query,
} from "type-graphql";
import argon2 from "argon2";
import { v4 as uuid } from "uuid";

import { User } from "../entities/User";
import { MyContext } from "../types";
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from "../constants";
import { sendEmail } from "../utils/sendEmail";
// import { EntityManager } from "@mikro-orm/postgresql;

@InputType()
class UsernamePasswordInput {
  @Field()
  email: string;
  @Field()
  username: string;
  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

/**
 * @UserResponse
 * It will have either `errors` or `user` field.
 */
@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  /**
   * @CurrentUser
   */
  @Query(() => User, { nullable: true })
  async currentUser(@Ctx() { req, em }: MyContext): Promise<User | null> {
    // Not logged in
    if (!req.session.userId) {
      return null;
    }

    const user = await em.findOne(User, { id: req.session.userId });

    if (!user) return null;

    return user;
  }
  /**
   * @Register
   * @param options UserNamePasswordInput
   */
  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const foundUser = await em.findOne(User, { username: options.username });
    // todo: Add validation for email -> add actual validation library

    if (foundUser) {
      return {
        errors: [
          {
            field: "username",
            message: "This user already exists.",
          },
        ],
      };
    }

    if (options.username.length < 3) {
      return {
        errors: [
          {
            field: "username",
            message: "Username must be longer than 2 letters.",
          },
        ],
      };
    }
    if (options.password.length < 3) {
      return {
        errors: [
          {
            field: "password",
            message: "Password must be longer than 2 characters.",
          },
        ],
      };
    }

    // Has the password to store
    const hashedPassword = await argon2.hash(options.password);

    // Create user
    const user = em.create(User, {
      username: options.username,
      email: options.email,
      password: hashedPassword,
    });

    await em.persistAndFlush(user);

    // ---------
    // This was made in the tutorial because `persistAndFlush` was giving an error - mine works fine so I'm leaving this off
    // let user
    // try {
    //   const response = await (em as EntityManager).createQueryBuilder(User).getKnexQuery().insert({
    //     username: options.username,
    //     password: hashedPassword,
    //     created_at: new Date(),
    //     updated_at: new Date()
    //   }).returning("*");
    //   user = response[0]
    // } catch (err) {
    //   console.log("ERROR ----- ", err);
    // }
    // ---------

    // Automatially log in user after registering.
    req.session.userId = user.id;

    return { user };
  }

  /**
   * @Login
   * @param options UserNamePasswordInput
   */
  @Mutation(() => UserResponse, { nullable: true })
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    // Try finding an user based on the username
    const isEmail = usernameOrEmail.includes("@");
    const user = await em.findOne(
      User,
      isEmail ? { email: usernameOrEmail } : { username: usernameOrEmail }
    );

    // todo: Add validation library
    // If there is no user, return new UserResponse object
    // with errors(type FieldError[]) and no user(type User)
    if (!user) {
      return {
        errors: [
          {
            field: "usernameOrEmail",
            message: "Username doesn't exist.",
          },
        ],
      };
    }

    // Same thing but with invalid password
    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "Password is incorrect.",
          },
        ],
      };
    }

    req.session.userId = user.id;

    // If user exist and password is valid, return UserResponse object
    // with user(type User) and no errors(type FieldError[])
    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME); // ? Should the cookie be deleted even if the session was not destroyed. If yes, should be move to below the if statement
        if (err) {
          console.log(err);
          resolve(false);
        }
        resolve(true);
      })
    );
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Arg("email") email: string,
    @Ctx() { em, redis }: MyContext
  ) {
    const user = await em.findOne(User, { email });
    if (!user) {
      // email not in the database
      return false;
    }

    const token = uuid();
    await redis.set(
      FORGOT_PASSWORD_PREFIX + token,
      user.id,
      "ex",
      60 * 60 * 24
    ); // one day

    const content = `<a href="http://localhost:3000/change-password/${token}"></>`;
    sendEmail(user.email, content);
    return true;
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, em, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length < 3) {
      return {
        errors: [
          {
            field: "newPassword",
            message: "Password must be longer than 2 characters.",
          },
        ],
      };
    }
    const key = FORGOT_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);
    if (!userId) {
      return {
        errors: [
          {
            field: "token",
            message: "Token is invalid or expired, please try again.",
          },
        ],
      };
    }

    const user = await em.findOne(User, { id: parseInt(userId) });

    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "User no longer exists.",
          },
        ],
      };
    }

    user.password = await argon2.hash(newPassword);
    await em.persistAndFlush(user);
    await redis.del(key);
    // automatically login user with
    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => UserResponse)
  async changeUsername(
    @Arg("newUsername") newUsername: string,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const user = await em.findOne(User, { id: req.session.userId });
    if (!user) {
      return {
        errors: [
          {
            field: "newUsername",
            message: "Something went wrong, please try again.",
          },
        ],
      };
    }

    const isTaken = await em.findOne(User, { username: newUsername });
    if (isTaken) {
      return {
        errors: [
          {
            field: "newUsername",
            message: "Username already exists.",
          },
        ],
      };
    }

    user.username = newUsername;
    await em.persistAndFlush(user);
    return { user };
  }
}
