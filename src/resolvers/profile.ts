import { Profile } from "../entities/Profile";
import { MyContext } from "src/types";
import { Arg, Ctx, Query, Resolver } from "type-graphql";

@Resolver(Profile)
export class ProfileResolver {
  @Query(() => String)
  async profile(@Ctx() { req }: MyContext): Promise<Profile | undefined> {
    const profile = Profile.findOne({ where: { user: req.session.userId } });
    return profile;
  }
}
