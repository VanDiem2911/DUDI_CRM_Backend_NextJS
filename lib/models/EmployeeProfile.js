import mongoose from 'mongoose';

const EmployeeProfileSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // Matches employeeId
  employeeId: { type: String, required: true },
  name: { type: String, default: "" },
  empName: { type: String, default: "" },
  avatarUrl: { type: String, default: "" },
  phone: { type: String, default: "" },
  email: { type: String, default: "" },
  gender: { type: String, default: "" },
  dob: { type: String, default: "" },
  cccd: { type: String, default: "" },
  cccdIssueDate: { type: String, default: "" },
  cccdIssuePlace: { type: String, default: "" },
  dept: { type: String, default: "" },
  job: { type: String, default: "" },
  contractType: { type: String, default: "" },
  status: { type: String, default: "" },
  start: { type: String, default: "" },
  endIntern: { type: String, default: "" },
  resignDate: { type: String, default: "" },
  university: { type: String, default: "" },
  bankName: { type: String, default: "" },
  bankAccount: { type: String, default: "" },
  note: { type: String, default: "" },
  currentAddress: {
    province: { type: String, default: "" },
    district: { type: String, default: "" },
    ward: { type: String, default: "" },
    street: { type: String, default: "" }
  },
  hometown: {
    province: { type: String, default: "" },
    district: { type: String, default: "" },
    ward: { type: String, default: "" },
    street: { type: String, default: "" }
  },
  galleryImages: { type: [String], default: ["", ""] },
  workHistory: {
    type: [{
      position: { type: String, default: "" },
      startDate: { type: String, default: "" },
      endDate: { type: String, default: "" }
    }],
    default: [{ position: "", startDate: "", endDate: "" }]
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

export default mongoose.models.EmployeeProfile || mongoose.model('EmployeeProfile', EmployeeProfileSchema);
