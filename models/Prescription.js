import mongoose from "mongoose";

const PrescriptionSchema = new mongoose.Schema(
  {
    consultationId: {
      type: String,
      required: true,
    },
    care: {
      type: String,
      required: true,
    },
    medicine: {
      type: String,
      default: "",
    },
    pdfPath: {
        type: String
    },
  },
  { strict: false, timestamps: true }
);

export default mongoose.model("Prescription", PrescriptionSchema);
