import mongoose from "mongoose";

export default mongoose.model("Doctor", new mongoose.Schema({
  name: String,
  specialty: String,
  email: { type: String, unique: true },
  phone: { type: String, unique: true },
  experience: Number
}));
