import { Entity, PrimaryKey, Property } from "@mikro-orm/core";
import { ObjectType, Field } from "type-graphql";

@ObjectType()
@Entity()
export class User {
  @Field()
  @PrimaryKey()
  id!: number;

  @Field(() => String)
  @Property({ type: "date" })
  createdAt = new Date();

  @Field(() => String)
  @Property({ type: "date", onUpdate: () => new Date() })
  updatedAt = new Date();

  @Field()
  @Property({ type: "text", unique: true })
  email!: string;

  // notice `username` must be unique
  @Field()
  @Property({ type: "text", unique: true })
  username!: string;

  // Notice how there is not @Field() decorator, we are not exposing the password to graphql
  @Property({ type: "text" })
  password!: string;
}
