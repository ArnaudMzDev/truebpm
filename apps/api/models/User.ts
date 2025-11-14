import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
    pseudo: string;
    email: string;
    password: string;
}

const UserSchema = new Schema<IUser>(
    {
        pseudo: { type: String, required: true, unique: true },
        email: { type: String, required: true, unique: true },
        password: { type: String, required: true }
    },
    { timestamps: true }
);

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);