import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import Doctor from "./models/Doctor.js";
import Patient from "./models/Patient.js";
import Consultation from "./models/Consultation.js";
import Prescription from "./models/Prescription.js";

dotenv.config();

/* ================= BASIC SETUP ================= */

const app = express();
app.use(cors());

/* ================= __dirname FIX ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= FILE UPLOAD (MULTER) ================= */

const storage = multer.diskStorage({
  destination: path.join(__dirname, "uploads"),
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/* ================= JSON (AFTER MULTER) ================= */

app.use(express.json());

/* ================= PDF STORAGE ================= */

const pdfDir = path.join(__dirname, "pdfs");
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

app.use("/pdfs", express.static(pdfDir));

/* ================= MONGODB ================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("Mongo error:", err));

/* ================= AUTH ================= */

// Doctor signup
app.post("/doctor/signup", async (req, res) => {
  try {
    const doctor = await Doctor.create(req.body);
    res.json(doctor);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.post(
  "/patient/signup",
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const {
        name,
        age,
        email,
        phone,
        surgeryHistory,
        illnessHistory,
      } = req.body;

      // ✅ basic validation
      if (!name || !email || !phone) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // ✅ prevent duplicates
      const existing = await Patient.findOne({
        $or: [{ email }, { phone }],
      });

      if (existing) {
        return res
          .status(409)
          .json({ error: "Email or phone already registered" });
      }

      const patient = await Patient.create({
        name,
        age,
        email,
        phone,
        surgeryHistory,
        illnessHistory: illnessHistory
          ? illnessHistory.split(",").map(i => i.trim())
          : [],
        profileImage: req.file
          ? `/uploads/${req.file.filename}`
          : "",
      });

      res.json(patient);
    } catch (err) {
      console.error("Patient signup error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Logins (JSON only)
app.post("/doctor/login", async (req, res) => {
  const doctor = await Doctor.findOne({ email: req.body.email });
  res.json(doctor);
});

app.post("/patient/login", async (req, res) => {
  try {
    const { email, phone } = req.body;

    const patient = await Patient.findOne({ email, phone });

    if (!patient) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json(patient);
  } catch (err) {
    console.error("Patient login error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* ================= DATA ================= */

// Doctor list
app.get("/doctors", async (_, res) => {
  res.json(await Doctor.find());
});

// Create consultation
app.post("/consultation", async (req, res) => {
  res.json(await Consultation.create(req.body));
});

// Doctor dashboard
app.get("/doctor/consultations/:doctorId", async (req, res) => {
  res.json(await Consultation.find({ doctorId: req.params.doctorId }));
});

// Patient prescriptions
app.get("/patient/prescriptions/:patientId", async (req, res) => {
  try {
    const consultations = await Consultation.find({
      patientId: req.params.patientId,
    });

    const consultationIds = consultations.map(c => c._id.toString());

    const prescriptions = await Prescription.find({
      consultationId: { $in: consultationIds },
    });

    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= PRESCRIPTION ================= */
app.post("/prescription/:consultationId", async (req, res) => {
  try {
    const { care, medicine } = req.body;

    if (!care || care.trim() === "") {
      return res.status(400).json({ error: "Care is required" });
    }

    /* ================= FETCH DATA ================= */

    const consultation = await Consultation.findById(req.params.consultationId);
    if (!consultation) {
      return res.status(404).json({ error: "Consultation not found" });
    }

    const doctor = await Doctor.findById(consultation.doctorId);
    const doctorName = doctor?.name || "Doctor";

    /* ================= CREATE PDF ================= */

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 800]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    /* ================= HEADER ================= */

    page.drawText(`Dr. ${doctorName}`, {
      x: 50,
      y: 760,
      size: 14,
      font,
    });

    page.drawText(`Date: ${new Date().toDateString()}`, {
      x: 400,
      y: 760,
      size: 11,
      font,
    });

    /* ================= SEPARATOR ================= */

    page.drawRectangle({
      x: 0,
      y: 705,
      width: 600,
      height: 4,
      color: rgb(0, 0, 0.6),
    });

    /* ================= CARE ================= */

    page.drawText("Care to be taken", {
      x: 50,
      y: 670,
      size: 12,
      font,
    });

    page.drawRectangle({
      x: 50,
      y: 560,
      width: 500,
      height: 90,
      borderWidth: 1,
    });

    page.drawText(care, {
      x: 55,
      y: 635,
      size: 11,
      font,
      maxWidth: 480,
      lineHeight: 15,
    });

    /* ================= MEDICINE ================= */

    page.drawText("Medicine", {
      x: 50,
      y: 520,
      size: 12,
      font,
    });

    page.drawRectangle({
      x: 50,
      y: 400,
      width: 500,
      height: 100,
      borderWidth: 1,
    });

    page.drawText(medicine?.trim() || "-", {
      x: 55,
      y: 475,
      size: 11,
      font,
      maxWidth: 480,
      lineHeight: 15,
    });

    /* ================= FOOTER ================= */

    page.drawRectangle({
      x: 0,
      y: 365,
      width: 600,
      height: 4,
      color: rgb(0, 0, 0.6),
    });

    page.drawText(`Dr. ${doctorName}`, {
      x: 420,
      y: 335,
      size: 11,
      font,
    });

    /* ================= SAVE PDF (ANTI-CACHE FIX) ================= */

    const pdfBytes = await pdfDoc.save();

    // 🔥 UNIQUE FILE NAME (CRITICAL FIX)
    const fileName = `prescription_${req.params.consultationId}_${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    fs.writeFileSync(filePath, pdfBytes);

    /* ================= SAVE DB ================= */

    await Prescription.findOneAndUpdate(
      { consultationId: req.params.consultationId },
      {
        consultationId: req.params.consultationId,
        care,
        medicine,
        pdfPath: `/pdfs/${fileName}`,
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: "Prescription generated successfully",
      pdfUrl: `/pdfs/${fileName}`,
    });

  } catch (err) {
    console.error("Prescription error:", err);
    res.status(500).json({ error: err.message });
  }
});


/* ================= SERVER ================= */

app.listen(5000, () => {
  console.log("Server running on 5000");
});
