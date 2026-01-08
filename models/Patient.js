import mongoose from "mongoose";

export default mongoose.model("Patient", new mongoose.Schema({
  name: String,
  age: Number,
  email: { type: String, unique: true },
  phone: { type: String, unique: true },
  surgeryHistory: String,
  illnessHistory: [String],
  profileImage: String

}));
