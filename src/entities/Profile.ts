import { Field, ObjectType } from "type-graphql";
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
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
  @OneToOne(() => Planet)
  @JoinColumn()
  planet_of_origin: Planet;

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
