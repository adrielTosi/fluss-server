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

import { User } from "../entities/User";
import { MyContext } from "../types";

@InputType()
class UserNamePasswordInput {
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
 * Response from `login` mutation -
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
    @Arg("options") options: UserNamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    const foundUser = await em.findOne(User, { username: options.username });
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
      password: hashedPassword,
    });

    await em.persistAndFlush(user);

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
    @Arg("options") options: UserNamePasswordInput,
    @Ctx() { em, req }: MyContext
  ): Promise<UserResponse> {
    // Try finding an user based on the username
    const user = await em.findOne(User, { username: options.username });

    // If there is no user, return new UserResponse object
    // with errors(type FieldError[]) and no user(type User)
    if (!user) {
      return {
        errors: [
          {
            field: "login",
            message: "Wrong username or password",
          },
        ],
      };
    }

    // Same thing but with invalid password
    const valid = await argon2.verify(user.password, options.password);
    if (!valid) {
      return {
        errors: [
          {
            field: "password",
            message: "Password is incorrect",
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
}
