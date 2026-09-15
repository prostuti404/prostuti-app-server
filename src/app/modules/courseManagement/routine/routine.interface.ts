import { Model, Types } from "mongoose";
import { RoutineType } from "./routine.constant";


export type IRoutine={
    course_id: Types.ObjectId;
    type: RoutineType
    date:Date,
    isPublished?: boolean,
    createdBy:Types.ObjectId,
    updatedBy:Types.ObjectId
  }


  export type RoutineModel = Model<
  IRoutine,
  Record<string, unknown>
>;

export type IRoutineFilters = {
  searchTerm?: string;
  type?: string;
  ownRoutine?:string,
  date?:string,
  course_id?:string,
  isPublished?:string | boolean
}
