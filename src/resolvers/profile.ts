import isLogged from "../middlewear/isLogged";
import { MyContext } from "src/types";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { Profile } from "../entities/Profile";
import { User } from "../entities/User";
import { Planet } from "../entities/Planet";
import { getConnection } from "typeorm";

@InputType()
class UpdateProfileInput {
  @Field()
  planetOfOrigin?: number;
}

@Resolver(Profile)
export class ProfileResolver {
  @Mutation(() => Profile, { nullable: true })
  @UseMiddleware(isLogged)
  async updateProfile(
    @Ctx() { req }: MyContext,
    @Arg("newProfile") profileInput: UpdateProfileInput
  ): Promise<Profile | null> {
    // Find the logged user
    const user = await User.findOne({
      where: { id: req.session.userId },
      relations: ["profile"],
    });
    console.log(" >>>> !user", user);
    if (!user) {
      console.log(" >>>> !user", user);
      // todo: I need a better and consistent way to deal with errors
      return null;
    }

    // Check if user owns the profile
    const relatedProfile = await Profile.findOne({
      where: { id: user.profile.id },
    });
    console.log(" >>>> relatedProfile", relatedProfile);
    if (!relatedProfile) {
      console.log(" >>>> !relatedProfile", relatedProfile);
      return null;
    }

    let planetOfOrigin: undefined | Planet = undefined;
    if (profileInput.planetOfOrigin) {
      // Find the planet coming from front end
      planetOfOrigin = await Planet.findOne(profileInput.planetOfOrigin); // pass an id number
      if (planetOfOrigin) {
        // add the planet to the profile
        // relatedProfile.planetOfOrigin = planetOfOrigin;
        // await Profile.save(relatedProfile);

        // this code sets category of a given post
        await getConnection()
          .createQueryBuilder()
          .relation(Profile, "planetOfOrigin")
          .of(relatedProfile) // you can use just post id as well
          .set(planetOfOrigin); // you can use just category id as well
      }
    }
    return relatedProfile;
  }

  @Query(() => String)
  async profile(@Ctx() { req }: MyContext): Promise<Profile | undefined> {
    const profile = Profile.findOne({ where: { user: req.session.userId } });
    return profile;
  }
}
