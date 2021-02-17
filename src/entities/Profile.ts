import { Field, ObjectType } from "type-graphql";
import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { Planet } from "./Planet";
import { User } from "./User";

@ObjectType()
@Entity()
export class Profile extends BaseEntity {
  @Field()
  @PrimaryGeneratedColumn()
  id!: number;

  @Field(() => Planet, { nullable: true })
  @ManyToOne(() => Planet, (planet) => planet.id)
  planetOfOrigin: Planet | number;

  @Field(() => User)
  @OneToOne(() => User, (user) => user.profile)
  user: User;

  @Field(() => String)
  @CreateDateColumn()
  createdAt = new Date();

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt = new Date();
}
