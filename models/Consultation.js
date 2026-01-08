import mongoose from "mongoose";

export default mongoose.model("Consultation", new mongoose.Schema({
  doctorId: String,
  patientName: String,

  illnessHistory: String,
  recentSurgery: String,

  diabeticStatus: String,
  allergies: String,
  others: String,

  transactionId: String
}, { timestamps: true }));
