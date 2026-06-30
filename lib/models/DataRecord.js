import mongoose from 'mongoose';

const DataRecordSchema = new mongoose.Schema({
  businessName: { type: String, required: true },
  address: { type: String, default: "" },
  area: { type: String, default: "" },
  phone: { type: String, default: "" },
  website: { type: String, default: "" },
  businessType: { type: String, default: "" },
  googleMapUrl: { type: String, default: "" },
  status: { type: String, default: "Chưa xử lý" },
  assignedTo: { type: String, default: null },
  assignedToName: { type: String, default: null },
  createdBy: { type: String, default: null },
  note: { type: String, default: "" }
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

export default mongoose.models.DataRecord || mongoose.model('DataRecord', DataRecordSchema);
